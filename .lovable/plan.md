# Safe RLS fix 2 — membership-checked writes only

One additive migration. Write access on four tables gets a second, independent condition: the writer must actually belong to the group. Nothing dropped, no SELECT policy touched, no data changed.

## Pre-flight baseline (read now, read-only)

| Metric | Value |
| --- | --- |
| Groups | 2 |
| Active members (removed_at is null) | 5 |
| Expenses | 20 (0 without a group) |
| Settlements | 1 |
| Activity rows | 69 (16 personal, no group) |
| group_members rows owned by someone other than the group owner | 0 |
| Expenses written by someone other than the group owner | 0 |

Current write policies on the four tables — all identical in shape, all stay exactly as they are:

- `expenses` — `own expenses` (ALL, permissive, `auth.uid() = owner_user_id`)
- `group_members` — `own group members` (ALL, permissive, `auth.uid() = owner_user_id`)
- `settlements` — `own settlements` (ALL, permissive, `auth.uid() = owner_user_id`)
- `activity` — `own activity` (ALL, permissive, `auth.uid() = owner_user_id`)

Participant SELECT policies from fix 1 exist on all four and are not part of this change.

## Why the new policies must be RESTRICTIVE

Postgres combines permissive policies with OR. Adding another permissive policy would *widen* access, not narrow it. Adding a RESTRICTIVE policy ANDs the new condition on top of the existing owner check — that is the only way to tighten writes without dropping or rewriting the working `own …` policies. The owner check keeps working untouched; the new rule is applied in addition to it.

Each restrictive policy is scoped to a single command (INSERT, UPDATE, and for group_members also DELETE) so SELECT is provably unaffected.

## The migration

```sql
-- Owner-of-group helper. New function; is_group_participant is not read, not
-- altered, and its grants are not touched.
CREATE OR REPLACE FUNCTION public.is_group_owner(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.groups g
                 WHERE g.id = _group_id AND g.owner_user_id = _user_id);
$$;
GRANT EXECUTE ON FUNCTION public.is_group_owner(uuid, uuid) TO authenticated, service_role;

-- EXPENSES: group-scoped writes require participation; ungrouped stay allowed.
CREATE POLICY "expenses insert must be participant" ON public.expenses
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (group_id IS NULL OR public.is_group_participant(group_id, auth.uid()));

CREATE POLICY "expenses update must be participant" ON public.expenses
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (group_id IS NULL OR public.is_group_participant(group_id, auth.uid()))
WITH CHECK (group_id IS NULL OR public.is_group_participant(group_id, auth.uid()));

-- SETTLEMENTS: always group-scoped.
CREATE POLICY "settlements insert must be participant" ON public.settlements
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (public.is_group_participant(group_id, auth.uid()));

CREATE POLICY "settlements update must be participant" ON public.settlements
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (public.is_group_participant(group_id, auth.uid()))
WITH CHECK (public.is_group_participant(group_id, auth.uid()));

-- ACTIVITY: personal rows (group_id IS NULL) unchanged.
CREATE POLICY "activity insert must be participant" ON public.activity
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (group_id IS NULL OR public.is_group_participant(group_id, auth.uid()));

CREATE POLICY "activity update must be participant" ON public.activity
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (group_id IS NULL OR public.is_group_participant(group_id, auth.uid()))
WITH CHECK (group_id IS NULL OR public.is_group_participant(group_id, auth.uid()));

-- GROUP_MEMBERS: membership is owner-managed only.
CREATE POLICY "group members insert must be group owner" ON public.group_members
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (public.is_group_owner(group_id, auth.uid()));

CREATE POLICY "group members update must be group owner" ON public.group_members
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (public.is_group_owner(group_id, auth.uid()))
WITH CHECK (public.is_group_owner(group_id, auth.uid()));

CREATE POLICY "group members delete must be group owner" ON public.group_members
AS RESTRICTIVE FOR DELETE TO authenticated
USING (public.is_group_owner(group_id, auth.uid()));
```

## group_members — the careful part

Membership writes are restricted to the **group owner**, not to any participant, so a normal member cannot add or remove people. This matches how the app already behaves (the group settings screen only lets the owner manage members) and matches the data: zero existing rows were written by a non-owner.

Invitation claim is unaffected. `accept_group_invitation`, `claim_group_invitation` and `redeem_group_invitation` are all SECURITY DEFINER and insert the `group_members` row on behalf of the group owner, so they bypass RLS entirely. No invitation semantics are changed.

The helper reads only `groups` through a SECURITY DEFINER function, so there is no policy loop back into `group_members`.

## Not in scope

`expense_splits`, `expense_items`, `item_splits`, `people`, `groups`, `group_invitations` keep their current write rules. DELETE on expenses, settlements and activity stays owner-only as today.

## Verification after the migration (read-only, plus live app checks)

1. Re-run the baseline table and confirm every number is identical.
2. Confirm the four `own …` policies and the fix-1 participant SELECT policies still exist verbatim, with the new restrictive policies added alongside.
3. Confirm `is_group_participant`'s definition and grants are byte-identical to the pre-flight capture.
4. Legitimate write: as a real member, create an expense and a settlement in their own group — must succeed.
5. Unrelated group: same identity attempts an insert with a group_id they do not belong to — must be blocked by RLS.
6. Activity: group-scoped insert succeeds for a member; personal insert with `group_id IS NULL` still succeeds.
7. Member management: owner adds, renames, deactivates and removes a member; an invitation claim still links a person and creates no duplicate membership.
8. App regression pass: same groups, members, expenses, balances, settlements and activity visible on Home and the group screen.

If any baseline number or visible balance changes, I revert this migration and report — no second attempt.

## Change type

Database migration only: one new helper function and nine restrictive write policies. No frontend, no backend code, no storage, no data.
