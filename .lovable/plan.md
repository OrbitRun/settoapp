# Receipt scanner: correct quantity × unit price

Scope: receipt line parsing and the review-line display only. No changes to flow, groups, balances, auth, invitations, RLS, or stored data.

## What is actually wrong

For the Netto line

```text
KRYDDERBOLLER 15,00
2 x 7,50
RABAT 1,00-
```

the final amount (14,00) is already right, so the money math is fine. Two separate issues produce the wrong "2 × 15,00":

1. **Display.** `ReceiptItemRow` prints `"{quantity} ×"` and then the caller's detail string, which in `split.review.tsx` starts with the *line* original total (15,00). Concatenated it reads "2 × 15,00 · −1,00 rabat" — a line total presented as a unit price.
2. **Parsing robustness.** The model is free to put the printed line subtotal into `unit_price`. The server currently prefers `original_total` when present and otherwise multiplies `unit_price × quantity`, so a subtotal in `unit_price` silently becomes double the real original. Nothing today cross-checks `unit_price × quantity` against `original_total`.

## The change

### 1. Prompt (`parseReceipt.functions.ts`, system prompt)

Add an explicit rule for the two-line Danish/Nordic layout: a line printing an amount followed by `2 x 7,50`, `2 X 7,50`, `2 × 7,50`, `2 stk 7,50`, `2 stk. à 7,50`, `2 @ 7.50` means quantity 2, unit price 7,50, original total 15,00. The amount on the product line is the line subtotal, never the unit price. Add the Krydderboller example next to the existing one.

### 2. Server normalisation (`parseReceiptImage` handler, per-item loop)

Keep the existing flow; insert one reconciliation step before the current derivations, working with four explicit values per line: `quantity`, `unitPrice`, `originalTotal`, `discount`, `effectiveTotal`.

- If `unit_price` and `original_total` are both present and `quantity > 1`:
  - `unitPrice × quantity ≈ originalTotal` (±1 øre) → consistent, keep both.
  - `unitPrice ≈ originalTotal` → `unit_price` was the line subtotal; derive `unitPrice = originalTotal / quantity`.
  - Neither → cannot reconcile: keep `originalTotal` as authoritative for money, mark the line `uncertain` (shown as a per-item flag, not a receipt error).
- If only `unit_price` is present, `originalTotal = unitPrice × quantity` (unchanged behaviour).
- If only `original_total` is present, derive the unit price from it — this is the only case where the unit price is derived.
- Then `quantity × unitPrice − discount = effectiveTotal` is validated with a 1 øre tolerance; a mismatch flags the item, never rewrites the receipt total.

`ParsedReceiptLine` keeps its current shape; `originalUnitPriceMinor` is now always the detected pre-discount unit price when one was read (today it is null when there is no discount), so the display has a real unit price to show.

### 3. Display (`split.review.tsx` detail string, `ReceiptItem.tsx`)

Build the whole secondary line in the caller so the quantity and unit price stay one unit:

- quantity > 1, no discount: `2 × 7,50`
- quantity > 1, discount: `2 × 7,50 · −1,00 rabat`
- quantity 1, discount: `15,95 · −4,00 rabat`

`ReceiptItemRow` stops prepending its own `"{quantity} ×"` when a detail string is supplied, so nothing is printed twice. The main amount stays the final paid line amount (14,00).

### 4. Confidence stays per item

Unchanged: an unreconcilable line sets `uncertain` on that line only and adds `UNCERTAIN_ITEMS`. The receipt-level `TOTAL_MISMATCH` check on the sum of final line amounts is untouched, so the Netto receipt (22,25 + 11,95 + 14,00 = 48,20) still reconciles with no receipt-level warning.

## Verification

Acceptance: Netto 26 Aug 2019 — Cultura 22,25; Egelykke 15,95 − 4,00 = 11,95; Krydderboller shows `2 × 7,50 · −1,00 rabat` with 14,00; total 48,20, no mismatch text.

Regressions checked in the review screen: quantity 1 with no discount; quantity 1 with discount; quantity > 1 with no discount; receipt-level discount; percentage-only discount; a line where only a subtotal is legible (flagged, not fabricated).

## Files touched

- `src/lib/receipt/parseReceipt.functions.ts` — prompt section + per-item reconciliation in the handler loop.
- `src/routes/split.review.tsx` — detail string composition.
- `src/components/pari/ReceiptItem.tsx` — stop double-printing the quantity prefix.
- `src/lib/i18n.tsx` — one new key for the `qty × unit price` fragment (da/en).

Nothing else: no migration, no store, no RLS, no group or balance code.
