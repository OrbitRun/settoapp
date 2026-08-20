# Stage S2 — Durable group owner person reference

Additive only. Ownership authority stays with `groups.owner_user_id`. No app code, RLS, or auth function changes.

## Verified mapping (read-only check already run)

Both existing groups map to exactly one candidate person (linked to the owner account and a member of the group), so backfill coverage will be 100% with no ambiguity:

```text
Sheltertur 2026  owner c2415b89…  → 1 linked person, also a group member
Zia & Jonas      owner c2415b89…  → 1 linked person, also a group member
```

## Baseline (recorded before the migration)

Current counts: groups 2, people 10, group_members 5, expenses 20, settlements 1, activity 69 (expense_items / expense_splits / item_splits recorded in the same pass). Balance snapshot per group recorded before and compared after.

## Schema change

- Add `groups.owner_person_id uuid NULL` with FK to `public.people(id)` `ON DELETE SET NULL` (non-destructive; never cascade).
- Add `groups.orphaned_at timestamptz NULL`, left unpopulated.

## Backfill

Set `owner_person_id` only where exactly one person satisfies both: `linked_profile_id = groups.owner_user_id` and membership in that group. Groups with zero or multiple candidates are left NULL and reported; if coverage is under 100% the work stops there and rollback is offered.

No new `people` rows are created.

## Validation after migration

Counts unchanged for every table; no people created; `owner_user_id` values unchanged; `group_members` unchanged; every group has `owner_person_id` resolving back to the same auth identity; balances bit-identical to the baseline; group visibility, group editing permissions, invitation preview/redeem, `item_splits` load (no recursion), private-item isolation and non-participant blocking all re-checked.

## Rollback (documented, executed only if validation fails)

```sql
ALTER TABLE public.groups DROP CONSTRAINT groups_owner_person_id_fkey;
ALTER TABLE public.groups DROP COLUMN owner_person_id;
ALTER TABLE public.groups DROP COLUMN orphaned_at;
```

## Explicitly out of scope

`is_group_owner`, `is_group_participant`, RLS policies, grants, `can_read_expense_item`, the `item_splits` policy, person lifecycle columns, other `owner_user_id` columns, account deletion / transfer / anonymisation, and all frontend code. Stage S3 is not started.
