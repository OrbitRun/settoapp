# Foreign currency end-to-end + one money formatter + expense navigation

The currency data model already exists and works: expenses store `original_currency`, `original_total_minor`, `exchange_rate`, `exchange_rate_date`, `exchange_rate_source`, and splits store `original_amount_minor` next to the converted `amount_minor`. Rates are fetched for the purchase date and locked at save time. No migration or model change is needed.

What is broken is the display layer: several components format money with the profile currency (or a hardcoded `"DKK"` default) instead of the currency the value belongs to. And group expense rows are not tappable.

## 1. One formatter, currency always passed in

- `MoneyAmount` currently defaults to `currency = "DKK"`. Remove that default so it falls back to the profile currency, and give it an explicit `currency` prop that every caller must set when the value is not in system currency.
- Rule enforced everywhere: a component never decides the currency. It receives either the expense's original currency (transaction view) or the system currency (accounting view).

## 2. Split editors stop assuming the profile currency

`SplitRuleEditor` and `PercentageSplitEditor` format participant amounts with the default currency — this is the bug where the header shows €495 but Jonas shows "396 kr.". Both get a required `currency` prop used for every amount, the exact-amount input suffix, and the allocated/remaining/over hints. Passed from the split screens, item screen and expense edit as the draft/expense original currency. Equal, percent, shares, amount and per item all keep their current math (already in original minor units).

## 3. Receipt items

`ReceiptItemRow` renders the bare number today and gets its currency from context strings around it. It takes a `currency` prop so the row, its quantity/discount detail line and any right-hand slot format consistently. Expense detail's receipt item list currently uses `MoneyAmount` (system currency) — switched to the expense's original currency. Discount rendering, reconciliation and the 1-øre tolerance are untouched.

## 4. Activity

Activity rows show `metadata.amount_minor`, which is the converted amount. Collapsed rows show the original transaction amount in the original currency, resolved from the linked expense when it exists (falling back to the stored metadata amount in system currency for settlements and legacy rows). The expanded panel keeps the original amounts for the total and per-person distribution, and adds a secondary "Bogføres som …" line plus the rate only when the currencies differ.

## 5. Group and home expense rows

`ExpenseRow` gains an optional secondary amount. For foreign-currency expenses in the group ledger: system currency as the primary amount, `495,00 € · Betalt af Jonas` as the subtitle. For same-currency expenses nothing changes — no duplicated amount, no rate, no conversion UI. Home's recent list follows the same rule.

Group balances, home balances, settlement and "Gør op" stay entirely in system currency and read the stored converted amounts. No change to their calculations.

## 6. Tappable group expenses + back behaviour

`ExpenseRow` becomes a `Link` to `/expense/$expenseId` (one canonical detail screen, used from Groups, Home and Activity). Expense detail's back control uses browser history instead of a fixed route, so Groups → SANDRO → Back returns to the group and Activity → SANDRO → Back returns to Activity.

## 7. Expense detail and edit

Detail already shows the original amount as hero with the "Bogføres som" line and original-currency distribution; the remaining fixes are the receipt item currency and the back behaviour above. Edit keeps the currency panel and the original-currency split editor. When the amount or currency changes, the rate is re-resolved for the stored purchase date and the pair actually in use, then re-locked; original values are never overwritten by converted ones.

## 8. Same-currency and legacy expenses

When `original_currency` is null or equal to the expense currency, the app behaves exactly as today: one amount, no rate line, no conversion row. Existing DKK expenses keep their balances.

## Technical notes

- Touched files: `src/components/pari/MoneyAmount.tsx`, `rows.tsx`, `ReceiptItem.tsx`, `SplitRuleEditor.tsx`, `PercentageSplitEditor.tsx`, `src/routes/activity.tsx`, `groups.$groupId.tsx`, `home.tsx`, `expense.$expenseId.tsx`, `split.share.tsx`, `split.items.tsx`, `split.amount.tsx`, plus a few i18n keys.
- No database migration, no changes to `src/lib/split.ts`, `src/lib/fx.ts`, `src/lib/expense-money.ts` or the store's save paths.
- After the edits, grep the whole `src/` tree for `formatMinor(`, `MoneyAmount` and `currencyLabel()` calls without an explicit currency and confirm each remaining one is genuinely a system-currency (accounting) value.

## Verification

The SANDRO case end to end: EUR detected, review in €495,00 with the 7,4544 rate for 6 Mar 2024, shares 4:1 giving 396,00 € / 99,00 €, saved expense showing €495 primary and 3.689,93 kr. secondary, Activity showing 495,00 €, group ledger showing 3.689,93 kr. with €495 as context, balances and settlement in DKK. Plus a DKK receipt with discounts to confirm no regression and no conversion UI, and the two navigation paths into expense detail with correct back behaviour.
