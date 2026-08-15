# Clean Activity history + meaningful change history on Expense Detail

Activity stays a light overview (who/when only). The detailed "what changed" story moves to a collapsed History section on Expense Detail, driven by structured change sets recorded when an expense is edited.

## 1. Record structured changes on edit

Today an edit logs an activity row with only `title` and `amount_minor`, so no diff can be shown. Change `updateExpense` to build a structured change set by comparing the expense before and after the edit, and store it in the existing activity `metadata` (already a JSON column — no migration needed).

Captured changes (only fields that actually changed):
- title, amount (with currency), payer, group
- split mode (equal / percentage / shares / exact)
- per-person percentage or share values, before → after
- participants added / removed
- exchange rate (rate + currency pair)
- receipt items: count changed, plus per-item name/price change and added/removed

Creation and deletion keep logging as they do now (no diff needed).

## 2. Activity — lighter

- One row per expense (already the case) — keep it.
- Keep the compact `I dag · Zia & Jonas · Redigeret` status in the row metadata; make it plain text, not the toggle.
- Remove the duplicated standalone "Redigeret" button above the history list.
- In the expanded card, show the `Historik` list directly (event type + person + date/time), no diff details, oldest → newest as today.

## 3. Expense Detail — History section

Placed after the receipt-items panel and before the Redigér / Slet buttons.

Collapsed row: `Historik · 2 hændelser  ›` (inline expand, matching existing panel/row patterns — no new page).

Expanded, newest first:

```text
Redigeret af Jonas          I dag · 17:04
  Betaler ændret            Jonas → Zia
  Fordeling ændret          Jonas 50 % → 60 %
                            Zia   50 % → 40 %
Oprettet af Jonas           I dag · 17:02
```

Each event shows only its changed fields. Receipt-item changes summarise as "2 varer redigeret" with the per-item before/after lines underneath (capped, e.g. "6 varer blev ændret" when the list is long). Deleted expenses show `Slettet af …` as the newest event.

## 4. Localization

All new strings go through the existing i18n dictionary in Danish and English: Historik, hændelser, Betaler ændret, Fordeling ændret, Beløb ændret, Navn ændret, Gruppe ændret, Valutakurs ændret, tilføjet/fjernet, andel/andele, split-mode names. No hardcoded Danish.

## Technical notes

- New `src/lib/history.ts`: `diffExpense(before, after)` producing a typed `ExpenseChangeSet`, plus a `describeChanges()` helper turning the change set into localized lines. UI renders those lines; database field names never surface.
- `logActivity` metadata type widens from `Record<string, string | number>` to a JSON-compatible type so change sets fit.
- `ActivityEntry.metadata` in `src/data/types.ts` widens accordingly.
- `updateExpense` snapshots title, totals, payer, group, allocations (mode/percent/shares/participants), FX rate and items before writing, then diffs against the applied values.
- Old activity rows without a change set simply render the header line with no details — no migration or backfill.
- Guest mode keeps its current behaviour (single creation entry, no diff history).
- Untouched: split/balance/FX/settlement calculations, receipt parsing, navigation, existing Expense Detail layout above the new section.
