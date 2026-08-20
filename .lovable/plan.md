# Stage S3C-3 — Safe linked-person read + narrow display-name RPC

Backend capability only. No frontend change, no existing policy/function/grant/FK/data change. S3D/S3E/S3F/S4 not started.

## Baseline recorded (read-only, before any change)

people 10 — linked 4, unlinked 6; status active 10, former 0; is_self true 4 / false 6. group_members 5. expenses 20, expense_items 105, expense_splits 48, item_splits 0, settlements 1, activity 69. Policies on `people`: 2 (`own people` FOR ALL, `participants can read group people` FOR SELECT). Profiles with more than one active linked person: **0** — so test D must be verified structurally, not with live data.

Balances: group 440675a4 — Jonas −88765, Zia +88765. Group b29d9051 — Jonas +339417, Kasper −174632, Scott −164785.

## Part 1 — additive SELECT policy

```sql
CREATE POLICY "self linked people read"
  ON public.people AS PERMISSIVE FOR SELECT TO authenticated
  USING (linked_profile_id = auth.uid());
```

SELECT only. Both existing policies stay exactly as they are.

## Part 2 — narrow SECURITY DEFINER RPC

```sql
CREATE OR REPLACE FUNCTION public.update_my_people_name(_name text)
RETURNS TABLE(id uuid, name text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_name text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  v_name := btrim(_name);
  IF v_name IS NULL OR v_name = '' THEN RAISE EXCEPTION 'name must not be empty'; END IF;
  RETURN QUERY
  UPDATE public.people p SET name = v_name
   WHERE p.linked_profile_id = auth.uid() AND p.status = 'active'
  RETURNING p.id, p.name;
END; $$;

REVOKE ALL ON FUNCTION public.update_my_people_name(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_people_name(text) TO authenticated;
```

- Takes only `_name`. No user_id, no person_id — identity comes from `auth.uid()` inside the function, so there is nothing a caller can point at somebody else's row with.
- The SET list contains one column. `owner_user_id`, `linked_profile_id`, `is_self`, `status`, `unlinked_at`, `created_at`, `id` are unreachable by construction.
- `status = 'active'` excludes former people.
- Updates every active linked row for the account, which is the multi-group case.
- Returns only the ids/names it changed — no unrelated people data.
- No `avatar_url` write. No broad self UPDATE policy.

## Validation to run after applying

A self read; B outsider read returns no rows; C RPC changes only `name` (full column-by-column diff of the affected rows, before vs after); D multi-row behaviour verified structurally from the predicate plus an EXPLAIN, since no such live case exists; E wrong-user impossible — no identity argument exists, verified by calling as a second account and confirming only that account's own rows return; F former exclusion verified structurally; G direct `UPDATE people` from a non-owner linked session still returns 0 rows; H `get_invitation_preview` / redeem / claim unchanged; I counts, memberships, expenses and per-group balances bit-identical, `item_splits` reads 200 with no recursion. Any temporary name change is restored to its exact original value.

If any security or regression test fails I stop and report — no automatic corrective migration.

## To apply

Switch to build mode and I will run this as a single migration, then execute the test matrix and report items 1–16.
