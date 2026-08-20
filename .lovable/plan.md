# Fix item_splits RLS recursion — isolated security fix

## Diagnosis (verified read-only)

Current SELECT policies:

- `expense_items` → "participants can read shared group expense items": checks the parent expense is a group the user participates in, AND (`is_shared` OR **a subquery on `item_splits`** linking the user's person).
- `item_splits` → "participants can read group item splits": subquery on **`expense_items`** joined to `expenses`, AND (`ei.is_shared` OR **a subquery on `item_splits` itself** (`s2`)).

Exact cycle:

```text
item_splits SELECT policy
  -> reads expense_items
     -> expense_items SELECT policy
        -> reads item_splits
           -> item_splits SELECT policy   <-- recursion
```

Plus a second, independent cycle: the `item_splits` policy's own `s2` subquery reads `item_splits`, re-triggering the same policy.

Both `expenses` policies use only `is_group_participant(...)` (SECURITY DEFINER) and are not part of the cycle.

## Pre-fix baseline (recorded)

| Table | Rows |
| --- | --- |
| groups | 2 |
| people | 10 |
| expenses | 20 |
| expense_items | 105 |
| expense_splits | 48 |
| item_splits | 0 |
| settlements | 1 |
| activity | 69 |

Balance snapshot (minor units, per group/person):

- 440675a4… : 0b6bbff7 +188765, e7f8f0de −188765
- b29d9051… : 2f2bdc79 −174632, c75816d4 −164785, e7f8f0de +339417

## The fix (smallest safe change)

One new narrow SECURITY DEFINER boolean helper that evaluates item visibility without re-entering RLS, then replace exactly one policy on `item_splits`. Nothing else is dropped or altered.

```sql
CREATE OR REPLACE FUNCTION public.can_read_expense_item(_item_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.expense_items ei
    JOIN public.expenses e ON e.id = ei.expense_id
    WHERE ei.id = _item_id
      AND e.group_id IS NOT NULL
      AND public.is_group_participant(e.group_id, _user_id)
      AND (
        ei.is_shared
        OR EXISTS (
          SELECT 1 FROM public.item_splits s
          JOIN public.people p ON p.id = s.person_id
          WHERE s.expense_item_id = ei.id AND p.linked_profile_id = _user_id
        )
      )
  );
$$;
REVOKE ALL ON FUNCTION public.can_read_expense_item(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_expense_item(uuid, uuid) TO authenticated;

DROP POLICY "participants can read group item splits" ON public.item_splits;
CREATE POLICY "participants can read group item splits"
ON public.item_splits FOR SELECT TO authenticated
USING (public.can_read_expense_item(expense_item_id, auth.uid()));
```

Why this preserves privacy: the helper body is the *same* predicate the policy used — group participation AND (shared item OR the user is personally assigned to that item). Nothing is widened; private item assignments stay hidden from participants who are not on the item. Because the helper is SECURITY DEFINER, its internal reads of `expense_items`/`item_splits` do not evaluate RLS, so the cycle is broken at both places.

The `expense_items` policy keeps its `item_splits` subquery, which now resolves through the non-recursive item_splits policy — cycle gone with a single policy replacement.

## Explicitly untouched

`is_group_participant` and its grants, `groups`, `group_members`, `settlements`, `activity`, `expenses` policies, the `expense_items` policy, invitation functions, auth, `people.status` / `unlinked_at`, foreign keys, ownership, UI, and all Stage S2 work.

## Post-fix verification

1. Reproduce-then-confirm: the previously failing `expense_items` / `item_splits` load returns 200, no recursion error in console or network.
2. Owner loads expenses, expense_items and item_splits successfully.
3. Participant reads only permitted item_splits.
4. Private-item isolation: a participant not assigned to a private item sees no splits for it.
5. Non-participant identity returns zero rows.
6. Re-run every baseline count and the balance snapshot — must be bit-identical.
7. Invitation preview and claim still work.

If any count or balance differs, the migration is reverted and reported — no second attempt.

## Change type

One database migration: one new helper function, one policy replaced on `item_splits`. No frontend, no schema, no data changes.
