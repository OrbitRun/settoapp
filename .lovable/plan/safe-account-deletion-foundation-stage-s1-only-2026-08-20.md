# SAFE ACCOUNT-DELETION FOUNDATION — STAGE S1 ONLY

## Goal
Prepare the `people` table to distinguish normal active/unclaimed people from people whose authenticated account has later been deleted/anonymised, without changing any current behaviour.

## What will change
Add two columns to `public.people`:

- `status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','former'))`
  - `active` covers both claimed users and ordinary unclaimed placeholders.
  - `former` is reserved for the future account-deletion flow.
- `unlinked_at timestamptz NULL`
  - Records when a profile was unlinked from a historical person.

All existing rows receive `status = 'active'` and `unlinked_at = NULL`.

## What will NOT change
- No rows deleted, renamed, or rewritten.
- `linked_profile_id` untouched.
- No changes to RLS policies, `is_group_participant`, `is_group_owner`, grants, functions, triggers, auth, or profile mapping.
- No FK changes (`owner_user_id`, `groups` ownership, etc.).
- No UI, groups, members, balances, expenses, splits, settlements, activity, invitations, receipts, storage, FX, or branding changes.
- `claim_group_invitation`, `redeem_group_invitation`, `accept_group_invitation`, and invitation creation stay exactly as today.
- No `display_name_override` or anonymisation added.

## Baseline to record before migration
- people row count
- claimed vs unclaimed people counts
- groups visible to the test owner user
- group member counts
- expense counts
- settlement counts
- activity counts
- group balances per person

## Post-migration validation
1. Every existing people row has `status = 'active`.
2. Every existing unclaimed placeholder still has `linked_profile_id = NULL`.
3. Every existing claimed person remains linked to the same profile.
4. No person IDs changed.
5. No membership rows changed.
6. No expenses/splits/settlements/activity changed.
7. Invitation claiming still works exactly as before.
8. Group visibility is identical.
9. Balances are identical.

## Rollback
Drop the two new columns (and the implicit check constraint). No application code depends on them yet, so rollback is safe.

## Implementation sequence
1. Record baseline counts/balances/visibility.
2. Run the additive migration.
3. Re-run the same counts/balances/visibility checks.
4. Confirm zero `former` rows.
5. Report results and stop.
