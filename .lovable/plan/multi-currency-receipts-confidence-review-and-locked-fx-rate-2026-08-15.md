# Multi-currency receipts, confidence review and locked FX rates

Extends the existing receipt and expense flow with per-item parsing confidence, real currency detection, and a currency model where the receipt keeps its original currency while all balances and settlement run in the profile currency using a rate locked at confirmation. Existing discount handling, split modes, groups and settlement stay as they are.

## 1. Receipt review: confidence is not selection

Two separate concepts, shown separately.

- The parser returns a confidence level per line (`high` / `medium` / `low`) plus confidence for merchant, total and currency.
- High-confidence lines are accepted silently — no per-line approval.
- Medium lines get a subtle dot/indicator; low lines get a visible "tjek denne linje" marker.
- Header summary: "18 varer fundet · 15 ser korrekte ud · 3 bør tjekkes", where the second part is tappable to jump to the first uncertain line.
- "Vælg alle" / "Fravælg alle" keep their current meaning: which items take part in the split. Their labels get a small clarifying caption so they read as split selection, not OCR approval.
- The green "✓ Det ser rigtigt ud" shows when merchant, total and currency are confident, items reconcile against the receipt total (existing 1-øre tolerance), and discounts reconcile. Otherwise the existing mismatch text.

Discount rendering ("299,95 · −40,00 rabat", Rabat summary row, reconciliation tolerance) is untouched, only re-rendered in the receipt currency.

## 2. Currency detection

The parser prompt and schema gain: `currency` (ISO code), `currencyConfidence`, and `currencyEvidence` (what it saw: ISO code, symbol, total line, merchant address, VAT wording, number format). Rules encoded in the prompt:

- Explicit ISO code on a total/payment line is the strongest signal ("Total Con Iva EUR 495.00" → EUR, high confidence).
- `€` / `£` are near-unambiguous; `$` and `kr.` are ambiguous and must be resolved with merchant country/address, VAT terminology and language before being reported at high confidence.
- Never fall back to the profile currency. If nothing decides it, report low confidence and let the user pick.

Review screen shows a "Valuta" row: quiet when confidence is high, promoted with a confirm prompt when low. Tapping opens a currency picker.

## 3. Currency belongs to the expense

The draft, expense and manual amount flow carry their own currency.

- Receipt review, item rows, totals, split configuration and result all format in the *original* currency.
- Manual expense screen gets a currency chip next to the amount; when it equals the profile currency nothing changes visually from today.

## 4. Split first, convert after

1. Discounts are applied in the original currency (unchanged logic).
2. Participant shares are calculated in the original currency by the existing split engine — equal, percentage, shares, exact, per item all unaffected.
3. One rate for the whole expense converts each share to system currency, with largest-remainder allocation of the øre remainder so converted shares sum exactly to the converted expense total.
4. If original currency == system currency, rate = 1 and no conversion UI appears.

The split screen stays primary in the original currency with a subtle "Omregnes til DKK ≈ 3.692,70 kr." line.

## 5. Rate source and locking

- Rates come from the ECB reference set via the public Frankfurter API, called from a server function, with historical lookup by date. Fetched rates are cached in a small `fx_rates` table so the same date/pair is not re-fetched.
- Date used: the detected receipt date when confident, otherwise the expense creation date.
- The rate is written onto the expense at confirmation and never refreshed. Later market moves cannot change historical balances.
- If the rate cannot be fetched, the user is asked to enter one before confirming rather than being blocked or silently defaulted.

## 6. Stored values

Expense gains: `original_currency`, `original_total_minor`, `system_currency`, `converted_total_minor`, `exchange_rate`, `exchange_rate_date`, `exchange_rate_source` (`ecb` | `manual` | `card`). Expense splits gain `original_amount_minor` alongside the existing converted `amount_minor`. Expense items keep original-currency amounts.

Balances, group balances, "hvem skylder hvem" and "Gør op" read the stored converted amounts only — no conversion at render time, no live FX.

## 7. Rate override and actual card amount

In expense detail/edit:

- "Valutakurs — 1 EUR = 7,46 DKK" with helper text "PARI foreslog denne kurs. Du kan ændre den, hvis banken brugte en anden."
- Optional "Faktisk trukket fra kort" field; entering it derives `rate = charged / original` and stores source `card`.
- Changing either recalculates converted shares, converted total and balances. Original amounts are never rewritten. Already-settled history follows the existing settlement-protection rules.

Expense detail shows both: original currency for the purchase, system currency for the debt, plus the rate and its date.

## 8. Payment methods

The parser explicitly classifies gift card / voucher / cash / card lines as payment lines, not discounts and not products, so a 500 EUR purchase paid partly by gift card still splits as 500 EUR.

## Technical notes

- Migration: new columns on `expenses` and `expense_splits` (backfilled from existing rows with rate 1 and the profile currency), plus an `fx_rates` cache table with grants and RLS.
- `src/lib/money.ts` gains explicit per-call currency formatting (symbol for €/$/£, "kr." for DKK) — the existing global default stays for system-currency output.
- New `src/lib/fx.ts` (conversion + remainder allocation) and `src/lib/fx.functions.ts` (server function fetching/caching rates).
- `src/lib/receipt/parseReceipt.functions.ts`: schema and prompt additions for currency, per-line confidence and payment-line classification; existing discount normalisation untouched.
- `SplitDraft` gains `currency`, `currencyConfidence`, `exchangeRate`, `exchangeRateDate`, `exchangeRateSource`.
- Touched screens: `split.review`, `split.share`, `split.amount`, `split.result`, `expense.$expenseId`. Home, groups, activity and settle keep their current look and read converted amounts.
- Guest mode keeps the same model in local storage so a guest split in EUR survives signup.

## Verification

Manual passes over: DKK/DKK, EUR/DKK (the Sandro receipt: 495,00 € preserved, "✓ Det ser rigtigt ud", 247,50 € each, converted DKK shares summing exactly), SEK and USD receipts, ISO-code vs symbol-only vs ambiguous "kr.", foreign receipt with line and receipt-level discounts, percentage/shares/exact/per-item splits in a foreign currency, manual foreign expense, edited rate, card-amount override, and a 3-participant rounding check.
