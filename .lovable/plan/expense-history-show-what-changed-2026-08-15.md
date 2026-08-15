# Expense History — show what changed

Goal: each "Redigeret af …" row in the History card can be tapped to reveal only the fields that changed, in plain Danish/English.

## Current state (verified)

- The structured diff engine already exists (`src/lib/history.ts`) and the edit path already tries to store a `changes` object on the activity row.
- However, the two most recent edit events in the database store only `{title, amount_minor}` — no `changes` payload. So today there is nothing to render, which matches what you see. It is not yet confirmed whether those edits simply predate the diff code or whether the diff is coming back empty; step 1 settles that.
- The History card currently expands as one block: all events and all details open together, instead of per-event expansion.

## What will be done

1. Verify persistence: perform a controlled edit (change payer and a percentage) and inspect the stored activity row. If the change set is empty or missing, fix the snapshot/diff path so before/after values are captured reliably — including title, amount, payer, group, split method, per-person split values, added/removed people, FX rate, and receipt items.
2. Per-event expansion: History stays collapsed by default. Opening it lists events (who + when only). Each edit event becomes tappable with a chevron; expanding shows only its changed fields. Creation and deletion events stay non-expandable.
3. Change rendering: a compact label per changed area with the before → after values under it, e.g.
   - Betaler — Jonas → Zia
   - Fordeling — Jonas 50 % → 60 % / Zia 50 % → 40 %
   - Navn — IKEA København → IKEA Gentofte
   - Beløb — 4.500,00 kr. → 4.713,00 kr.
   - Personer — Zia tilføjet / Mads fjernet
   - Varer — "2 varer ændret", with the individual item changes listed underneath when available
4. Old events without stored change data keep showing only "Redigeret af [navn] · [tid]". No history is reconstructed from current state.
5. All labels come from the existing i18n dictionary (Danish + English).

## Out of scope

No changes to calculations, balances, currency/FX handling, receipt parsing, split logic or navigation. The card's design and placement stay as they are.

## Technical notes

- `src/data/store.tsx` (`updateExpense`): confirm the before-snapshot is built from the live expense and the after-snapshot from the committed patch, and that `changes` is always written when non-empty.
- `src/lib/history.ts`: keep `diffExpense`/`describeChanges`; adjust the split and item lines so per-person values and item details render as specified rather than being suppressed by the current line cap.
- `src/components/pari/ExpenseHistory.tsx`: add per-event open state.
