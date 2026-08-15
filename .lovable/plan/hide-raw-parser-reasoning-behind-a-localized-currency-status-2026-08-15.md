# Hide raw parser reasoning behind a localized currency status

The Receipt Found screen currently appends the AI's raw explanation to the localized label, so users see text like "Fundet på kvitteringen · Danish receipt wording including "RABAT"...". The fix is presentation-only.

## What changes

- The currency note under the detected currency shows one short localized line, never the parser's own words.
- Which line is shown depends on how sure the detection was:
  - Confident detection: "Fundet på kvitteringen" / "Found on receipt"
  - Weaker/inferred detection: "Valuta genkendt ud fra kvitteringen" / "Currency recognised from the receipt"
- The detailed reasoning stays in the data for debugging, just not rendered.

## What does not change

Currency detection logic, parsing, discounts, line items, totals, exchange rates, conversion and split logic are untouched.

## Technical notes

- `src/routes/split.review.tsx`: stop building `detectedNote` by concatenating `t("currency.detected")` with `draft.currencyEvidence`; pick a key from `draft.currencyConfidence` instead (`high` → `currency.detected`, otherwise `currency.inferred`).
- `src/lib/i18n.tsx`: add `currency.inferred` to both dictionaries (`en`, `da` — the only supported languages); keep `currency.detected` as-is.
- Audit: `currencyEvidence` is only rendered in `split.review.tsx`; `warnings` codes are already mapped to localized strings. Confirm no other route renders raw parser strings (`merchant`-derived reasoning, warning codes, evidence) and fix any found.

## Verification

Load a parsed receipt in Danish and English UI, confirm only the localized one-liner appears with no parser text or language leakage.
