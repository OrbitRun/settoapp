# Finish the group + split polish pass

Remaining work from the current sprint, plus one real data bug found while checking the database.

## 1. Group members are never saved (confirmed bug)

Both existing groups in the database have zero members, and the only people rows that exist are the three "me" records created automatically for each account. So when a group is created, neither the extra people nor the membership rows land — which is exactly why opening a group and starting a split shows 0 participants and an empty member list.

The create-group code ignores the results of its person and membership inserts, so the failure is silent and the exact reason is not yet known. Fix approach:

- Check and log the result of every insert in the create-group path, surface a clear error to the user instead of navigating to a broken group.
- Reproduce the create-group flow in the browser with the network response visible, identify the rejected insert, and fix the cause.
- Backfill: when a group is opened and has no membership rows, do not silently show an empty group — the owner is always a member, so ensure the owner's person row is added.

## 2. Participants shown in a split

- Only show people who are relevant to the current split: the current user, anyone already selected, and the members of the selected group. People left over from unrelated past splits should not appear pre-listed.
- Adding a person stays available and adds to the current split.
- The counter reflects the actual number of selected participants; increasing it creates placeholders ("Person 2", "Person 3") rather than pulling in strangers from earlier splits.

## 3. Fresh state when starting a new split

Entering the split flow from the group screen, the plus button, or the start screen always begins from a clean draft: no stale participants, amount, items, or group from the previous split. Coming from a group keeps that group's members and default split rule.

## 4. Home empty states

- No groups at all: invite to create the first split.
- Groups exist but no expenses yet: a different, encouraging message rather than the "nothing here" state.
- "Seneste" stays hidden when there is nothing recent.

## 5. Remaining Danish strings

Translate the leftover hardcoded labels in the receipt review flow ("qty", the price currency suffix) and audit the receipt item card for other untranslated text.

## Technical notes

- Files: `src/data/store.tsx` (create-group path, error handling), `src/components/pari/ParticipantPicker.tsx` (roster scoping), `src/routes/split.amount.tsx` and `src/routes/split.start.tsx` / `src/components/pari/AppShell.tsx` (draft reset), `src/routes/home.tsx` (empty states), `src/routes/split.review.tsx` and `src/lib/i18n.tsx` (strings).
- No schema change is expected; grants and access rules on the membership table already look correct, so the fix is in the app code unless the reproduction shows otherwise.
