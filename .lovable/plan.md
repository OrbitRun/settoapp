# PARI — Polished Guest Quick Split

Guests can already open the split flow, but the participant step is built for accounts with saved people and groups, so a guest usually ends up splitting with only "Mig". This pass rebuilds the participant step around temporary people, makes the split methods and result usable without an account, and finishes the Danish localization. No visual redesign, no navigation changes.

## 1. Participant step (the core fix)

A new shared participant block used by both the manual amount screen and the receipt share screen:

- "Mig" is always present and selected by default; tapping its name lets the guest rename it inline (optional, never required).
- "Antal personer" stepper: `[-] 4 [+]`. Increasing adds "Person 2", "Person 3"… as temporary people and selects them; decreasing removes the last unnamed ones. Named people are never silently removed.
- "+ Tilføj person" opens a small inline field with "Navn" and "Tilføj"; the person is added and selected immediately.
- Any participant name can be tapped and edited; long-press/× removes a temporary person.
- "Vælg alle / Fravælg alle" on the participant list.

Both paths write to the same list, so the fast (count) and named paths are one UI, not two modes. Temporary people live in the existing guest local storage, so a reload keeps them and the split in progress.

For signed-in users the same block appears, backed by their saved people plus the same "add person" affordance.

## 2. Manual Quick Split screen

Order becomes: amount → optional title → "Hvem deler denne?" (participant block) → "Fordeling" → live result.

- Group selection is removed from the guest primary flow (still shown for signed-in users who have groups).
- "Fordeling" defaults to "Lige dele" and stays collapsed; tapping reveals Lige dele / Procent / Beløb / Andele.
- The result updates live on every change — no calculate step. Equal split shows the "582 kr. · 3 personer · 194 kr. hver" summary.
- Percentage: existing numeric field behaviour, two-person auto-balance, live amounts.
- Exact: per-person amounts with "582 / 582 kr. fordelt ✓" or "42 kr. mangler at blive fordelt"; finishing is blocked until it matches.
- Shares: simple stepper per person with live amounts.

## 3. Receipt flow for guests

Same participant block replaces the group picker on the receipt share screen. Item assignment on the items screen works with temporary people exactly as with group members, including "Vælg alle / Fravælg alle" for both people and items. No group required anywhere.

## 4. Result screen

Tightened spacing and hierarchy (title, total, allocations, actions) inside the existing design system — less empty space, no other visual change.

Actions:
- "Del resultat" — native Web Share where supported, otherwise "Kopiér resultat" to clipboard. Localized text: title — total, then one line per person, then "PARI".
- "Gem som gruppe" — for guests this opens the existing account sheet ("Gem gruppen i PARI" / "Opret konto" / "Ikke nu"), keeping the completed split intact through signup and migration.
- "Færdig" — returns home, split stays in the local guest history.

Guest splits are never written to the backend unless the user signs up.

## 5. Localization and currency

Audit every string in the guest flow and move the remaining hardcoded English into the i18n dictionary (both languages): Vælg gruppe, Ingen gruppe — kun disse personer, Færdig, Fordeling, Gem disse personer som en gruppe, Del resultat, Hvem deler denne?, Vælg alle / Fravælg alle, Betalt af, split-mode labels and hints, receipt share headings, "hver", "personer".

Danish currency presentation becomes "582 kr." / "582,00 kr." instead of "582 DKK"; DKK stays the internal currency code. English keeps its current format.

## Technical notes

- New `src/components/pari/ParticipantPicker.tsx` (count stepper + named add + rename + bulk select) replacing `ParticipantSelector` usage in `split.amount`, `split.share`, and reused by `split.items`.
- `src/data/store.tsx`: add `renamePerson`, and make `addPerson` in guest mode append to the local guest people list and to `draft.participants` in one step; add a helper to set participant count.
- `src/data/draft.ts`: `splitModeLabel` becomes i18n keys rather than English literals.
- `src/lib/money.ts`: locale-aware currency symbol ("kr." for `da-DK`/DKK) in `formatMoney`.
- `src/routes/split.result.tsx`: spacing pass, Web Share API with clipboard fallback, "Gem som gruppe" routed through `requireAccount("create_group")` for guests.
- `GroupPicker` renders only when there is a session and at least one group.
- Also fixes the current hydration warning on the home greeting (server/client language mismatch) by rendering the greeting after hydration.
