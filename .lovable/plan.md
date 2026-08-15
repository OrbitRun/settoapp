# Receipt discounts: line discounts, receipt discounts and effective prices

Today the parser reads only `name / quantity / unit_price` per line, so a "Linierabat 40,00" is either dropped or turned into a fake item. The Bog & idé receipt then shows 299,95 in items against a 259,95 total and the review screen says "Der er 40,00 kr. for meget". This pass teaches the parser about discounts and makes the amount used for splitting the actually paid price. No UI redesign, no changes to split, participant or group logic.

## 1. What the AI is asked for

The structured schema gets a richer item shape and receipt-level discount fields:

- item: `name`, `quantity`, `unit_price`, `original_total`, `discount_amount`, `discount_percent`, `effective_total`, `uncertain`
- receipt: `subtotal`, `discount_amount` (receipt-level only), `tax`, `total`

The prompt is extended to explain discounts explicitly:
- discount wording to recognise in several languages — Linierabat, Linjerabat, Rabat, Vare-rabat, Tilbud, Kampagnerabat, Medlemsrabat, Bonus, Prisnedsættelse, Discount, Item discount, Promo, Promotion, Coupon, Voucher, Saving, You saved
- a discount line is never a purchased item
- a discount printed directly under an item belongs to that item; a discount printed between subtotal and total is a receipt-level discount
- discounts may print as `-40,00`, `40,00-`, or plain `40,00` next to a discount label — always a deduction, a minus sign is not required
- when both a percentage and an amount are printed, the printed amount wins; the percentage is metadata only
- when the printed amount is missing but a percentage is, derive the amount from the item's original total
- if it is unclear which item a discount belongs to, keep it as a receipt-level discount and add a warning instead of guessing

## 2. What the server returns

Each parsed line carries: original unit price, discount (minor units), optional percentage, and the effective unit price actually paid. `effectiveTotal` is authoritative; when only two of original/discount/effective are present the third is derived, and inconsistent trios are resolved as `effective = original − discount` with an `uncertain` flag.

Receipt level gains `discountMinor` plus `subtotalMinor`.

Reconciliation now runs on effective totals:
`sum(effective item totals) − receipt discount` vs `total`. Within a 1 kr. rounding tolerance the receipt is reconciled and no mismatch warning is emitted. For the sample receipt this is exactly 0.

New warning code `UNASSIGNED_DISCOUNT` when a discount could not be attached to a line.

## 3. What the app does with it

- `DraftItem` keeps `unitPriceMinor` as the **effective paid** unit price, so every existing split, share and total calculation keeps working unchanged. Three optional fields are added alongside it: `originalUnitPriceMinor`, `discountMinor`, `discountPercent`.
- A receipt-level discount is stored on the draft and, for split math, prorated across shared items by value using the existing largest-remainder rounding, so the item sum always equals the receipt total to the øre. It is still displayed as its own line, not merged into a product name.

## 4. Review screen (existing layout, extra detail only)

- An item with a discount shows its effective price as the main figure, with a small supporting line underneath: `299,95 · −40,00 rabat`.
- The summary block gains a "Rabat" row when a receipt-level discount exists.
- "Der er X kr. for meget / mangler" only appears when the reconciliation above genuinely fails.
- When a discount could not be attached: `Vi fandt en rabat på 40,00 kr. Tjek hvilken vare den tilhører.`

## 5. Manual editing

The existing edit sheet gains discount fields in the same style as today's price/quantity row:

```text
Varenavn
Antal            Original pris
Rabat            Betalt (calculated, editable)
```

Editing original or rabat recalculates betalt; editing betalt recalculates rabat. The user never does the arithmetic. Items with no discount look exactly as they do today.

## 6. Verification

Acceptance case — the Bog & idé / Legekæden Slagelse photo: merchant read, original 299,95, discount 40,00, effective 259,95, receipt total 259,95, difference 0,00, no "for meget" text.

Regression cases run through the parser and the review screen: item with no discount; two items with one discounted; several discounted items; receipt-level discount (subtotal 500 / rabat 50 / total 450); percentage-only discount; discount with no minus sign; quantity > 1; member/loyalty discount; coupon; øre-level rounding differences.

## Technical notes

- `src/lib/receipt/parseReceipt.functions.ts`: extended json_schema (all new fields nullable), rewritten discount section of the system prompt, discount normalisation + derivation helpers, effective-total reconciliation, `UNASSIGNED_DISCOUNT` warning, new payload fields.
- `src/lib/receipt/parseReceipt.ts`: map discount fields onto `DraftItem`, carry `receiptDiscountMinor` and warnings.
- `src/data/draft.ts`: optional `originalUnitPriceMinor` / `discountMinor` / `discountPercent` on `DraftItem`, `receiptDiscountMinor` on `SplitDraft`, proration helper used by `itemsTotalMinor`-based reconciliation.
- `src/components/pari/ReceiptItem.tsx`: optional discount detail line.
- `src/routes/split.review.tsx`: rabat summary row, tolerance-aware difference text, discount fields in the edit sheet.
- `src/lib/i18n.tsx`: Danish + English keys for rabat, original pris, betalt, and the unassigned-discount notice.
