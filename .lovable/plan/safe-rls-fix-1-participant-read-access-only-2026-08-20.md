# Safe RLS fix 1 — participant read access only

One additive migration. Three new SELECT policies. Nothing dropped, nothing altered, no data touched.

## Pre-flight baseline (recorded now, read-only)

| Group | ID | Active members | Expenses | Expense total | Settlements | Activity |
| --- | --- | --- | --- | --- | --- | --- |
| Zia & Jonas | 440675a4-1979-498f-92a4-4e71eab9e38a | 2 | 12 | 12.622,48 kr. | 1 | 41 |
| Sheltertur 2026 | b29d9051-d4b4-488a-9516-8dcac91e65a0 | 3 | 8 | 6.304,05 kr. | 0 | 12 |

Existing policies on the three target tables (all stay exactly as they are):

- `settlements` — `own settlements` (ALL, `auth.uid() = owner_user_id`)
- `activity` — `own activity` (ALL, `auth.uid() = owner_user_id`)
- `item_splits` — `own item splits` (ALL, `auth.uid() = owner_user_id`)

For reference, `expense_splits` and `expense_items` already carry the participant-read pattern this change copies.

## The migration

```sql
CREATE POLICY "participants can read group settlements"
ON public.settlements FOR SELECT TO authenticated
USING (public.is_group_participant(group_id, auth.uid()));

CREATE POLICY "participants can read group activity"
ON public.activity FOR SELECT TO authenticated
USING (group_id IS NOT NULL AND public.is_group_participant(group_id, auth.uid()));

CREATE POLICY "participants can read group item splits"
ON public.item_splits FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.expense_items ei
    JOIN public.expenses e ON e.id = ei.expense_id
    WHERE ei.id = item_splits.expense_item_id
      AND e.group_id IS NOT NULL
      AND public.is_group_participant(e.group_id, auth.uid())
      AND (
        ei.is_shared
        OR EXISTS (
          SELECT 1 FROM public.item_splits s2
          JOIN public.people p ON p.id = s2.person_id
          WHERE s2.expense_item_id = ei.id AND p.linked_profile_id = auth.uid()
        )
      )
  )
);
```

Notes on the item_splits condition: it mirrors the existing `expense_items` participant policy exactly, so a private receipt line stays private — participants only see assignments for lines they are already allowed to see.

`activity` rows with `group_id IS NULL` (personal, non-group activity) stay owner-only.

## Safety

- Additive only — no `DROP POLICY`, no `ALTER POLICY`, no policy replaced.
- `is_group_participant` is called, never redefined; no grant on it is touched.
- No change to `groups`, `group_members`, `expenses`, write policies, balances, invitations, storage, FX, UI or any row of data.
- SELECT only on all three new policies.

## Post-change verification (read-only queries, run right after)

1. Re-run the baseline table above and confirm identical group count, member count, expense count, expense total, settlement count and activity count.
2. Confirm the three old policies still exist and the three new ones were added (six rows total across the three tables).
3. Participant check: with a second member's identity, confirm the group's settlements, activity and item_splits are now readable.
4. Unrelated-user check: with an identity that is not in the group, confirm zero rows are returned from all three tables for that group.

If any baseline number changes, I stop and revert this migration — no automatic second attempt.

## Change type

Database migration + RLS change only. No frontend, no backend code, no storage, no external configuration.
