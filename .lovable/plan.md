# PARI — Guest-first Quick Split, auth only when it must persist

Login stops being a gate. PARI opens on a welcome screen, a guest can complete a full split (including AI receipt scan) without an account, and authentication is asked for only when something must be saved. No redesign of the existing screens.

## 1. Welcome / first run

New first screen shown when there is no session:
- Title and short PARI line.
- Primary: "Split en regning" / subtitle "Scan en kvittering eller indtast et beløb" → starts the guest Quick Split.
- Secondary: "Log ind" → existing auth screen.
- Below: "Ny bruger? Opret konto" → auth screen in signup mode.

Signed-in users keep landing on today's Home. All copy comes from the i18n dictionary (Danish device → Danish, everything else → English).

## 2. Guest mode

The app no longer redirects to `/auth` when there is no session. Instead a guest workspace exists locally on the device:

- Temporary people added by name (starting with "Mig" / "Me"), no database.
- No groups, no activity, no balances, no Peter, no demo data.
- Guest can: scan/photograph a receipt, run the real AI parser, enter an amount manually, split equally / by percentage / by exact amount / by item, mark items private, see the result and copy-share it.
- Guest state (draft + temporary people + last result) is stored locally, so a reload or a Google redirect never loses the split.
- Bottom navigation for guests shows Home (welcome) + Split; Groups, Activity and Profile show a short "account needed" state with the signup call to action rather than an empty screen.

New accounts also start completely empty — the demo seeding (Peter, Bofællesskabet, Sommerhus, Skiferie) is removed.

## 3. Contextual signup sheet

Anywhere a guest tries something persistent — save an expense, create/save a group, open balances, history, settlement, collaboration — a bottom sheet appears instead of a redirect:

- "Gem din split"
- "Opret en konto for at gemme dine udgifter, grupper og saldi."
- Primary "Opret konto", secondary "Ikke nu" (dismiss, stay in guest flow, keep the result on screen).

The sheet also offers "Log ind" for existing users.

## 4. Preserving the split through signup

Before leaving for auth, the pending guest split (draft, items, temporary people, chosen split mode) is saved locally. After a successful signup or login — including the Google redirect path — PARI:

1. Creates the temporary people in the account (skipping any that already match by name).
2. Saves the expense with its items and splits.
3. Lands the user on the result/expense detail for that split.

The user never repeats the scan or the split. If migration fails, the guest split stays intact and an error toast is shown.

## 5. Auth screen

Kept as-is and reachable only by explicit choice: email/password, Google, plus an Apple sign-in path prepared behind the same provider helper (rendered only when enabled), so turning Apple on later is a configuration change rather than a rewrite.

## 6. Localization

Every new string (welcome, guest states, signup sheet, migration toasts) goes through the existing i18n dictionary in both Danish and English. No hardcoded strings in components. Existing split-flow strings that are still hardcoded English (share screen, result screen headings and buttons) are moved into the dictionary in the same pass.

## Technical notes

- `src/data/store.tsx` gains a guest layer: when `session` is null it serves people, draft and a locally computed "result" from a persisted guest store (localStorage) instead of Supabase, and exposes `isGuest` plus `requireAccount(reason)` which opens the signup sheet.
- Write operations (`addExpense`, `createGroup`, `markSettled`, `addPerson` for saved people) return a "needs account" signal in guest mode instead of hitting the database.
- Guest result rendering: `split/result` reads from the guest store when there is no `expenseId` from the database, so the same screen serves both modes.
- The auth gate in `src/routes/__root.tsx` is removed; `/` renders welcome vs. Home based on session.
- A migration drops the demo seeding from `handle_new_user` (and the `pari_seed_*` helper functions) so new accounts start empty.
- Guest receipt parsing already runs through the server function without auth; it stays unauthenticated with the existing size/type validation.
