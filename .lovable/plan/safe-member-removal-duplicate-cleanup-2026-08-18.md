# Safe member removal + duplicate cleanup

Adds owner-only member removal that never touches financial history, plus a verified cleanup of the empty duplicate Zia.

## What I verified in the data first

Group "Zia & Jonas" has three members:

```text
Jonas   e7f8f0de…  linked      16 paid, 21 splits, 1 settlement
Zia A   0b6bbff7…  not linked   3 paid, 12 splits, 1 settlement   <- historical, keep
Zia B   36d6b42f…  linked       0 paid, 0 splits, 0 settlements, 0 activity, 0 item splits
```

Zia B has no financial references at all. The only invitation row in that group points at Zia A, not Zia B, so deleting Zia B does not affect the claim flow. Zia B is a true empty duplicate.

## 1. Membership state (schema)

Add one additive column: `group_members.removed_at timestamptz null`. No key changes, no backfill, no second membership system.

- Active member = row with `removed_at is null`.
- Removed member = row kept, `removed_at` set. All history keeps resolving names through `people`.

Update `is_group_participant` so a removed member no longer counts as an active participant (loses future read access), while every historical row stays stored. No other policies touched.

## 2. Removal rules

Tapping a person in Group → Personer opens a person sheet (existing BottomSheet style) with balance, link status and, for the group owner only, "Fjern fra gruppe" at the bottom. Regular members see the sheet without that action.

- Owner tapping themselves: no remove action; if attempted, message "Overdrag ejerskab eller slet gruppen, før du forlader gruppen."
- Case A, no financial references anywhere (expenses, splits, item splits, settlements, activity, invitations): physically delete the `group_members` row and, when the person record is unused everywhere else and unlinked, the `people` row too.
- Case B, historical person without account: keep person + membership row, set `removed_at`.
- Case C, linked member with history: same — set `removed_at`, access removed, identity and history preserved.

## 3. Balance handling

Balances are computed from expenses and settlements, not from membership, so deactivating a member never changes any number. A non-zero balance therefore does not block removal in cases B/C; the person keeps appearing in the group's balance and settlement views (marked "Tidligere medlem") until settled. Case A deletion is only offered when there is nothing financial to preserve, so it can never move a balance.

## 4. Confirmation copy (Danish)

No history:
"Fjern Zia fra gruppen? Denne person har ingen økonomisk historik og kan fjernes." → "Fjern person" / "Annuller"

With history:
"Fjern Zia fra gruppen? Zia mister adgang til gruppen, men tidligere udgifter, fordelinger og afregninger bevares." → "Fjern fra gruppe" / "Annuller"

## 5. Display and counts

- Member count and participant pickers use active members only.
- Personer tab lists active members as today; removed people appear only when they still carry a balance or history, under a quiet "Tidligere medlemmer" section with the label "Fjernet".
- Button label changes from "+ Invitér ny person" to "+ Tilføj person" (EN: "+ Add person"); the existing add/invite behaviour is unchanged.

## 6. Duplicate Zia cleanup

After the feature works, delete only Zia B (`36d6b42f…`) — its membership row and its now-unused person row. Zia A is untouched: same ID, same +887,65 kr., same expenses, splits, settlement and open invitation. Expected after: 2 active members, all historical counts identical.

## Technical notes

- Migration: `alter table public.group_members add column removed_at timestamptz`; replace `is_group_participant` to require `gm.removed_at is null`.
- `src/data/store.tsx`: `groupPersonIds` filters `removed_at`; add `groupRemovedPersonIds`; rewrite `removeGroupMember` to classify A/B/C (returning the classification so the UI can pick the right confirmation) and to block owner self-removal.
- `src/routes/groups.$groupId.tsx`: person rows open a new `MemberSheet` component; the remove action lives there. `src/routes/groups.$groupId_.edit.tsx` reuses the same store call.
- i18n keys added in both Danish and English.
- Before/after snapshot queries on group id, member ids, expense/split/settlement/activity counts and balances; revert if any historical value moves.

Untouched: receipt parsing, FX, split algorithms, payer logic, balance/settlement engines, activity grouping, branding, navigation, invitation semantics.
