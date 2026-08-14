# PARI — Bugfix and polish pass

No new features, no redesign. Six targeted fixes.

## 1. Logged-in users cannot pick their saved people

Confirmed root cause: accounts created after demo seeding was removed have **no person rows at all** — not even a "me" record. A check of the accounts shows the newest one has 0 people, so the participant picker renders an empty list and the +/- stepper is the only way to add anyone, which is why it manufactures "Person 2 / Person 3".

Fix:
- On sign-in, make sure the account has a "me" person linked to the profile (created once, named from the profile display name). Backfill this for existing accounts that lack one.
- The participant picker keeps showing all saved people with a clear selected state, add-person and rename.
- In the authenticated manual/receipt split, selecting a group pre-selects that group's members (already wired) and the picker below stays available for adding or deselecting people.
- Change the +/- stepper so that, when signed in, increasing the count first selects existing saved people and only offers "add person" when they run out — it must never silently create generic "Person N" records for an authenticated user. Guest mode keeps its current temporary-person behaviour untouched.

## 2. Finish the Danish localization

Pass over every authenticated and guest screen for hard-coded English. Confirmed offenders include the new-expense bottom sheet in the app shell ("Split an expense", "Scan receipt", "Add amount", …), the onboarding slides, the group detail tabs (Expenses / People / Rules), settle-up, receipt scan errors and fallbacks, auth error toasts, and the "Nothing here" / "This page didn't load" root screens.

Approach: add the missing keys to the existing dictionary (Danish + English) and replace every literal, rather than patching individual labels. Danish copy for the new-expense sheet as suggested: "Del en udgift", "Klar på få tryk.", "Scan kvittering", "Tag et billede eller vælg et", "Indtast beløb", "Opret en udgift manuelt", "Flere kvitteringer". Page titles/meta stay English (SEO), UI strings become localized.

## 3. Remove seeded demo activity

Seeded rows are identifiable: the four demo groups (Bofællesskabet, Sommerhus, Anna & mig, Skiferie) and the demo people/expenses were all written by the seed function at the exact moment the profile row was created. A migration will delete, for each existing account, those seed-created groups plus their expenses, items, splits, settlements and activity rows, and the seed-created people that no genuine record references. Verified that the only real user's genuine data (group "Huset", the "Split" and "JYSK" expenses, people Jonas/Zia/Vera) does not depend on any seeded row.

New accounts are already seed-free (the seed function is gone from the signup trigger); the migration also drops the leftover seed functions so it cannot come back.

Delete flows: confirm the expense detail screen offers delete for genuine expenses and that the activity feed reflects the deletion, and add the delete affordance where it's missing.

## 4. Profile → Personer divider artifact

The people card always renders a separator right before the "+ Tilføj person" row. That separator will only render when the list above it actually has entries, so the card matches the rest of the settings page.

## 5. Home → "Seneste" empty state

The section renders an empty card when there are no recent expenses. When the list is empty, the whole "Seneste" block — heading included — is not rendered. It reappears as soon as there is a first real expense.

## 6. Regression check

After the changes, walk both flows in the preview browser: authenticated (login → + → new expense → choose/add people → split → finish → activity → open/delete) and guest (start → split → temporary people → finish → share), plus a Danish/English switch across new expense, profile, activity, groups and auth.

## Technical notes

- Migration: cleanup DELETEs scoped per owner, plus `DROP FUNCTION pari_seed_starter_data / pari_seed_expense`; a small SQL backfill inserting a missing `is_self` person per profile.
- Client: a "ensure self person" step in the data store after sign-in; participant stepper branches on `isGuest`; i18n keys added to `src/lib/i18n.tsx`.
