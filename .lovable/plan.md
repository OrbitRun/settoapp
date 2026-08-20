# Harden can_read_expense_item — drop the caller-supplied user id

One migration. Same visibility predicate, identity taken from `auth.uid()` inside the function instead of from the caller.

## Why

`public.can_read_expense_item(_item_id uuid, _user_id uuid)` is SECURITY DEFINER and executable by `authenticated`. The policy passes `auth.uid()`, but any signed-in client can call the function directly with someone else's UUID and probe whether that person can see a given item. Removing the parameter closes that entirely.

## Baseline to re-verify after (already recorded)

groups 2 · people 10 · expenses 20 · expense_items 105 · expense_splits 48 · item_splits 0 · settlements 1 · activity 69

Balances (minor units): 440675a4… 0b6bbff7 +188765 / e7f8f0de −188765 · b29d9051… 2f2bdc79 −174632 / c75816d4 −164785 / e7f8f0de +339417

## The migration

```sql
-- 1. New single-argument helper; identity derived internally.
CREATE OR REPLACE FUNCTION public.can_read_expense_item(_item_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.expense_items ei
    JOIN public.expenses e ON e.id = ei.expense_id
    WHERE ei.id = _item_id
      AND e.group_id IS NOT NULL
      AND public.is_group_participant(e.group_id, auth.uid())
      AND (
        ei.is_shared
        OR EXISTS (
          SELECT 1 FROM public.item_splits s
          JOIN public.people p ON p.id = s.person_id
          WHERE s.expense_item_id = ei.id AND p.linked_profile_id = auth.uid()
        )
      )
  );
$$;
REVOKE ALL ON FUNCTION public.can_read_expense_item(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_expense_item(uuid) TO authenticated;

-- 2. Point the one policy at the new signature.
DROP POLICY "participants can read group item splits" ON public.item_splits;
CREATE POLICY "participants can read group item splits"
ON public.item_splits FOR SELECT TO authenticated
USING (public.can_read_expense_item(expense_item_id));

-- 3. Remove the two-argument version so no caller-supplied identity remains.
DROP FUNCTION public.can_read_expense_item(uuid, uuid);
```

The predicate body is byte-for-byte the previous one with `_user_id` replaced by `auth.uid()`. No visibility rule changes.

## Explicitly untouched

`is_group_participant` and its grants, the `expense_items` policy, `expenses` policies, every other RLS policy, all data, and Stage S2.

## Verification after the migration

1. Load `expense_items` / `item_splits` in the app — no recursion, no 500.
2. Owner reads expenses, items and item splits normally.
3. A permitted participant reads the item splits they should see.
4. A private item stays hidden from a participant who is not assigned to it.
5. A non-participant identity returns zero rows.
6. Re-run the baseline counts and balance snapshot — must be identical.
7. Confirm the two-argument function no longer exists (a direct call with another user's UUID fails to resolve) and the one-argument version is granted only to `authenticated`.

If anything differs, the migration is reverted and reported.

## Change type

Database migration only: one function signature replaced, one policy repointed. No frontend, no schema, no data.
