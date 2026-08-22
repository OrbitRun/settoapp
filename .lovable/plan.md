# Stage S3D-4 — Durable group authority cutover audit (read-only)

No changes were made. One requested item could not be executed: the live transferred-owner test (section 4) writes temporary rows, which plan mode blocks. Its result is predicted statically below and is listed as step 1 of the implementation stage.

## 1. groups policy catalog (4 policies, all TO authenticated)

| Policy | Cmd | Type | USING | WITH CHECK |
|---|---|---|---|---|
| own groups | ALL | PERMISSIVE | `auth.uid() = owner_user_id` | `auth.uid() = owner_user_id` |
| participants can read groups | SELECT | PERMISSIVE | `is_group_participant(id, auth.uid())` | — |
| groups update must be group owner | UPDATE | RESTRICTIVE | `is_group_owner(id, auth.uid())` | `is_group_owner(id, auth.uid()) AND group_owner_fields_unchanged(id, owner_user_id, owner_person_id)` |
| groups delete must be group owner | DELETE | RESTRICTIVE | `is_group_owner(id, auth.uid())` | — |

Effective authority `(OR permissive) AND (AND restrictive)`:

- SELECT: `owner_user_id = uid OR is_group_participant`
- INSERT: `owner_user_id = uid` (no restrictive INSERT policy)
- UPDATE: `owner_user_id = uid` AND `is_group_owner` AND owner-column freeze
- DELETE: `owner_user_id = uid` AND `is_group_owner`

Key point: `owner_user_id = uid` is still a hard requirement for UPDATE/DELETE because it is the only permissive path for writes.

## 2. is_group_owner

Unchanged, `SECURITY DEFINER, STABLE, search_path=public`. Two branches:

- A (legacy): `groups.owner_user_id = _user_id`
- B (durable): `groups.owner_person_id` -> person `status='active'`, `unlinked_at IS NULL`, `linked_profile_id = _user_id`, plus an active `group_members` row (`removed_at IS NULL`)

Dependents: 5 RESTRICTIVE policies (`groups` UPDATE/DELETE, `group_members` INSERT/UPDATE/DELETE) plus the `transfer_group_ownership` function. ACL: authenticated/service_role/postgres only.

## 3. All group write paths (`src/data/store.tsx`)

| Path | Op | Uses RPC | Relies on owner_user_id | Reachable in prod UI |
|---|---|---|---|---|
| `createGroup` (~L976) | INSERT | yes, `create_group` | no (RPC is SECURITY DEFINER) | yes |
| `updateGroup` (~L1003) | UPDATE groups | no | yes (permissive) | yes |
| `setGroupArchived` (~L1102) | UPDATE groups | no | yes | yes |
| `deleteGroup` (~L1111-1134) | DELETE children + groups | no | yes | yes |
| `updateGroup` member defaults, `addGroupMembers`, `removeGroupMember` | INSERT/UPDATE/DELETE group_members | no | yes | yes |
| guest migration (~L275-375) | people/expenses/splits/items/activity only | n/a | yes | yes |

## 4. Direct groups INSERT — is it still needed?

No. A repo-wide search finds zero `from("groups").insert(...)` calls: `createGroup` is the only creation path and goes through the `create_group` RPC. Guest mode is local-only and guest->account migration creates personal expenses, never groups. So the legacy client INSERT capability on `public.groups` is dead code in the UI — but retiring it is a separate decision from the authority cutover and is not part of the recommended minimal migration.

## 5. Transferred-owner behaviour (static prediction — must be verified live first)

`transfer_group_ownership` moves `groups.owner_person_id` and `groups.owner_user_id` to the successor, but does not touch `group_members.owner_user_id`, `group_invitations.owner_user_id` or `people.owner_user_id` on existing rows. Consequences today:

| Operation after A -> B transfer | New owner B | Old owner A |
|---|---|---|
| rename / archive / delete group | allowed (both permissive and restrictive follow owner_user_id) | blocked |
| insert new group_members row (owner_user_id = B) | allowed | blocked by restrictive |
| update/delete existing group_members rows (owner_user_id = A) | blocked — fails the permissive `own group members` check | blocked — fails restrictive `is_group_owner` |
| create invitation (owner_user_id = B) | allowed | allowed only for own rows, restrictive-free table |
| revoke existing invitations (owner_user_id = A) | blocked | allowed (invitations have no owner restrictive policy) |
| rename placeholders/people owned by A | blocked | allowed |

So a pre-existing dead zone already exists after a transfer: neither owner can edit member rows created before the transfer. This is the single most important finding and it is caused by child-row `owner_user_id`, not by `is_group_owner`.

## 6. group_members policies

| Policy | Cmd | Type | Condition |
|---|---|---|---|
| own group members | ALL | PERMISSIVE | `auth.uid() = owner_user_id` (using + check) |
| participants can read group members | SELECT | PERMISSIVE | `is_group_participant` |
| insert must be group owner | INSERT | RESTRICTIVE | `is_group_owner` |
| update must be group owner | UPDATE | RESTRICTIVE | `is_group_owner` |
| delete must be group owner | DELETE | RESTRICTIVE | `is_group_owner` |

If `is_group_owner` became durable-only today, nothing about the dead zone improves: the blocking factor for the new owner is the permissive `owner_user_id` clause, and the old owner is already blocked by the restrictive clause. Removing branch A would additionally break any group whose durable path is unhealthy.

## 7. Other dependencies

- Direct function dependents: only the 5 policies above and `transfer_group_ownership`.
- Indirect: `expenses`, `expense_items`, `expense_splits`, `item_splits`, `settlements`, `activity` are gated by `is_group_participant`, not ownership — unaffected. `group_invitations` and `people` are owner_user_id-only and unaffected. `deleteGroup` cleanup depends on those participant policies plus the groups DELETE authority. `create_group` is SECURITY DEFINER and bypasses policies.

## 8. Existing data readiness (2 groups)

Both groups pass every check: `owner_person_id` set, person exists, `status='active'`, `unlinked_at` null, `linked_profile_id = owner_user_id`, active membership present with `role='owner'` and `removed_at` null. No mismatches, nothing to repair.

## 9. Option comparison

- Option A (make `is_group_owner` durable-only now): highest blast radius — the same function backs group_members writes; any transitional-data drift instantly locks out real owners. Rejected.
- Option B (new `is_durable_group_owner`, used only by groups policies, plus replacing the `owner_user_id` permissive write path on groups): narrow, reversible, leaves `is_group_owner` and all group_members behaviour untouched. Recommended.
- Option C (do nothing until S3E): zero risk, zero progress; leaves groups authority tied to `owner_user_id`, which is the thing account deletion must remove.

## 10. Recommended S3D-4 design (SQL below is a proposal, not executed)

1. Add `public.is_durable_group_owner(_group_id uuid, _user_id uuid)` — the durable branch only (owner_person_id -> active linked person -> active membership), SECURITY DEFINER, `EXECUTE` to authenticated + service_role, revoked from PUBLIC and anon.
2. Split the `own groups` ALL policy so groups writes no longer depend on `owner_user_id`:
   - keep SELECT as-is (owner or participant),
   - replace the write side with a permissive UPDATE/DELETE policy gated on `is_durable_group_owner`,
   - keep a permissive INSERT policy on `auth.uid() = owner_user_id` for now (the RPC does not need it; retiring it is a separate step once the live test confirms no other creation path).
3. Keep both existing RESTRICTIVE policies, including the owner-column freeze, so ownership can still only move through `transfer_group_ownership`.

Resulting effective logic: SELECT unchanged; INSERT unchanged; UPDATE = durable owner AND `is_group_owner` AND owner columns unchanged; DELETE = durable owner AND `is_group_owner`. No widening to ordinary participants.

Proposed SQL is written out in full in the technical section below.

## 11. owner_user_id dependencies remaining after S3D-4

- groups: INSERT only (plus the column itself, still synced by the transfer RPC)
- group_members: full permissive ALL write path — the dead zone above; this is S3E's core job
- group_invitations: sole write authority, no group-anchored policy at all
- people: sole write authority for placeholders
- expenses / splits / items / activity / settlements: personal rows only; group rows already participant-gated
- functions: `create_group`, `redeem/claim/accept` invitation functions still stamp `owner_user_id` on new rows

## 12. Baseline confirmed

groups 2, people 10, group_members 5, expenses 20, expense_items 105, expense_splits 48, item_splits 0, settlements 1, activity 69, invitations 5, split sum 1,892,653 øre. groups policies 4, total policies 48, SECURITY DEFINER functions 12, linter 12 warnings (1 anon SECDEF = `get_invitation_preview`, 11 authenticated).

## Technical notes — proposed SQL for the implementation stage

Step 1 (must run first, in a rolled-back transaction) is the live transferred-owner matrix from section 5; if its results differ from the prediction, stop and re-plan before any policy change.

```sql
CREATE OR REPLACE FUNCTION public.is_durable_group_owner(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.groups g
    JOIN public.people p ON p.id = g.owner_person_id
    JOIN public.group_members gm
      ON gm.group_id = g.id AND gm.person_id = p.id AND gm.removed_at IS NULL
    WHERE g.id = _group_id
      AND g.owner_person_id IS NOT NULL
      AND p.linked_profile_id = _user_id
      AND p.status = 'active'
      AND p.unlinked_at IS NULL
  );
$$;
REVOKE ALL ON FUNCTION public.is_durable_group_owner(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_durable_group_owner(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_durable_group_owner(uuid, uuid) TO authenticated, service_role;

DROP POLICY "own groups" ON public.groups;

CREATE POLICY "own or participant groups read" ON public.groups
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_user_id OR public.is_group_participant(id, auth.uid()));

CREATE POLICY "create own groups" ON public.groups
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "durable owner updates group" ON public.groups
  FOR UPDATE TO authenticated
  USING (public.is_durable_group_owner(id, auth.uid()))
  WITH CHECK (public.is_durable_group_owner(id, auth.uid()));

CREATE POLICY "durable owner deletes group" ON public.groups
  FOR DELETE TO authenticated
  USING (public.is_durable_group_owner(id, auth.uid()));
```

The existing `participants can read groups` SELECT policy stays; both RESTRICTIVE policies stay untouched. Rollback is a single statement set: drop the four new policies and recreate the original `own groups` ALL policy.

Post-change regression must re-run the full S3D-3C suite plus the transferred-owner matrix, and confirm counts, ownership mappings, balances and linter counts are unchanged.
