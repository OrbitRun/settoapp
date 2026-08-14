# PARI — Real backend, real receipt AI, localization and full CRUD

Same product, same look. This iteration replaces prototype behaviour with real, persisted, trustworthy functionality.

## 1. Backend (Lovable Cloud)

Enable Cloud and move all data off the in-memory store, keeping the current screens and the demo-like first experience.

Tables (all with RLS, minor-unit integers, timestamps):
`profiles`, `people`, `groups`, `group_members`, `expenses`, `expense_items`, `expense_splits`, `item_splits`, `settlements`, `activity`.

- Auth: email/password sign-in with a `/auth` screen; protected app routes under the authenticated layout; Sign out in Profile becomes real.
- On first sign-in, a starter dataset (the current Bofællesskabet / Sommerhus / Anna & Peter groups, with correct recent dates) is seeded for that user, so the app never looks empty and never shows 1969/1970 dates.
- Private storage bucket for receipt images; images referenced from `expenses.receipt_image_url`.
- All balances stay derived from expenses + splits — nothing precomputed is stored.

## 2. Real receipt AI

- Server-side `parseReceipt(image)` service (Lovable AI, vision, strict JSON schema). No key in the browser, file type/size validated server-side.
- Removes the demo parser entirely — a real photo is always what gets analysed.
- Output: merchant, date, currency, `items[] {name, quantity, unit_price_minor, total_minor, confidence}`, `subtotal_minor`, `discount_minor`, `tax_minor`, `total_minor`, `confidence`, `warnings[]`.
- Prompt rules: read only what is visible, never invent items, keep quantities and discounts, prefer low confidence over guessing.
- Validation on review: sum of items vs total → "Beløbene stemmer" or "Der mangler 28,00 kr. …". Low-confidence lines flagged with "Tjek denne vare". Everything editable.
- Failure: "Vi kunne ikke læse kvitteringen" with Prøv igen / Tag et nyt billede / Indtast manuelt; the uploaded photo is kept.
- Provider stays isolated behind one service module so it can be swapped later.

## 3. Localization (da / en)

- Central i18n layer with translation keys; no visible string left hardcoded in a screen.
- Full Danish translation of every screen, sheet, empty state, button, error and toast (audited string by string).
- First launch: locale starting with `da` → Danish, everything else → English.
- Manual override in Profile (Dansk / English) persists and wins over device locale.
- Central formatters: money `4.293,83 kr.` (da) vs `DKK 4,293.83` (en); dates `14. aug. 2026` vs `14 Aug 2026`; relative labels (I dag / I går) localized.

## 4. Functional Profile

Each row does something real:
- Personal details — edit display name and avatar.
- Language — Dansk / English.
- Default currency — DKK preference, stored.
- Appearance — System / Light / Dark, with dark tokens audited across every screen.
- About PARI — small info page.
- Sign out — real.

## 5. Expense detail, edit, delete

One reusable Expense Detail screen for manual and receipt expenses (header: merchant/title, amount, date, paid by; then Fordeling, Varer for receipts, Aktivitet), with a `…` menu → Redigér / Slet.

- Edit supports title, merchant, date, total, payer, participants, split type, percentages, exact amounts, group, receipt items and item assignments; re-runs receipt validation.
- Receipt items: add/edit/delete (`Tilføj vare`, `Slet vare`), price, quantity, assignment, private/shared.
- Delete asks for confirmation ("Slet udgift? · Netto · 486 kr. · Gruppens saldi bliver opdateret"), removes splits and item splits, and updates Home, Group detail and Activity.

## 6. Activity

- Entries become tappable: expand to a detail sheet showing amount, date, payer, number of people, item count, with Se detaljer / Redigér / Slet.
- Edits and deletions are recorded in human language ("Peter slettede Netto", "Anna ændrede fordelingen") — no technical audit noise.

## 7. Select all / bulk actions

- `Vælg alle` / `Fravælg alle` (dynamic) wherever people are selected: manual expense, receipt split, item assignment, group participants.
- Same on receipt item screens, plus a bottom action bar when items are selected: "6 varer valgt" → `Del med…` / `Privat`, applying to all selected items at once.

## 8. Out of scope

No redesign, no charts, no gamification, no extra languages.

## Technical notes

- Backend logic uses TanStack server functions (`*.functions.ts`) with the Supabase auth middleware; the receipt parser reads the AI key only inside the handler.
- Money stays integer minor units end to end; splitting keeps the existing largest-remainder engine.
- The existing `usePari` store is re-implemented on top of TanStack Query + server functions so screens change as little as possible.
- Seed data is inserted per user at signup time with real relative dates, replacing `src/data/demo.ts`.
