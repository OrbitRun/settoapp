# Stage S3D-2 — Group write-policy design audit (read-only)

Nothing was changed. Everything below comes from the live policy catalog on `public.groups` and from reading the group write paths in `src/data/store.tsx`.

## 1. Current state on `public.groups`

| Policy | Type | Cmd | Roles | USING | WITH CHECK |
| --- | --- | --- | --- | --- | --- |
| `own groups` | PERMISSIVE | ALL | authenticated | `auth.uid() = owner_user_id` | `auth.uid() = owner_user_id` |
| `participants can read groups` | PERMISSIVE | SELECT | authenticated | `is_group_participant(id, auth.uid())` | — |

No RESTRICTIVE policy exists on `groups`. So today: read = owner OR participant; insert/update/delete = owner_user_id only.

`is_group_owner(_group_id, _user_id)` (after S3D-1) is TRUE when `groups.owner_user_id = _user_id` **or** the durable path holds (`owner_person_id` → active, linked person with a non-removed membership). It is a superset of the legacy check for every existing group, and it is SECURITY DEFINER so it never re-enters `groups` RLS.

## 2. Why INSERT must be treated separately

`createGroup` (store.tsx:976–1048) runs in this order:

```text
1. INSERT groups (owner_user_id = auth.uid(), owner_person_id NULL)
2. INSERT people rows for new names
3. INSERT group_members (owner row first)
4. on member failure: DELETE groups (rollback)
```

At step 1 the row has `owner_person_id = NULL` and **no** `group_members` row yet. `is_group_owner` on that row is TRUE only through the legacy `owner_user_id` branch. A WITH CHECK written purely as `is_group_owner(id, auth.uid())` would therefore still pass — but only because the legacy branch is still in the function. Making INSERT depend on the helper couples group creation to a predicate we intend to change later; the moment the legacy branch is removed, creation breaks (the durable branch cannot be satisfied inside the same statement).

The rollback `DELETE FROM groups` at step 4 also runs while the group has no membership row — so DELETE must keep working on a legacy-only group.

**Conclusion: yes.** S3D-2 should make UPDATE/DELETE durable and deliberately leave INSERT on the legacy `own groups` predicate until ownership creation/transfer gets its own controlled RPC (a SECURITY DEFINER `create_group` that writes the group, the owner person and the owner membership atomically, then sets `owner_person_id`).

## 3. Proposed migration (design only — not applied)

Two RESTRICTIVE policies. No new permissive grant, so no widening is possible; nothing is dropped, so `own groups` keeps protecting everything it protects today.

```sql
-- Existing-group edits must satisfy the durable owner predicate.
CREATE POLICY "groups update must be group owner"
ON public.groups AS RESTRICTIVE FOR UPDATE TO authenticated
USING (public.is_group_owner(id, auth.uid()))
WITH CHECK (
  public.is_group_owner(id, auth.uid())
  AND owner_user_id = (SELECT g.owner_user_id FROM public.groups g WHERE g.id = groups.id)
  AND owner_person_id IS NOT DISTINCT FROM
      (SELECT g.owner_person_id FROM public.groups g WHERE g.id = groups.id)
);

CREATE POLICY "groups delete must be group owner"
ON public.groups AS RESTRICTIVE FOR DELETE TO authenticated
USING (public.is_group_owner(id, auth.uid()));
```

Note on the two subselects: they read the *pre-update* row (the policy is evaluated against the table, not the new tuple), which is exactly the anti-seizure guard — the owner columns must stay byte-identical through any client UPDATE. Ownership transfer is then only possible through a future SECURITY DEFINER RPC, which bypasses RLS by design. If we prefer not to embed subselects in a policy, the equivalent is a `BEFORE UPDATE` trigger that raises when either owner column changes; the audit recommends the policy form for S3D-2 because it needs no new trigger object and rolls back with a single `DROP POLICY`.

No INSERT policy is added. No policy is dropped or altered. No grant, function, constraint or row is touched.

## 4. Effective behaviour with all policies combined

Postgres: `(OR of permissive) AND (AND of restrictive)`.

| Command | Permissive side | Restrictive side | Effective |
| --- | --- | --- | --- |
| SELECT | `own groups` OR participant read | none | unchanged |
| INSERT | `own groups` WITH CHECK `auth.uid() = owner_user_id` | none | unchanged — legacy only |
| UPDATE | `own groups` (`auth.uid() = owner_user_id`) | new durable owner + owner-columns-frozen | owner_user_id owner **and** durable owner, owner columns immutable |
| DELETE | `own groups` | new durable owner | owner_user_id owner **and** durable owner |

Because both sides must hold, UPDATE/DELETE today is still gated by `owner_user_id` — nothing is weakened, and the durable predicate is added on top. When a later stage drops the legacy permissive policy and replaces it with a durable permissive one, the restrictive layer is already in place and behaviour does not change for any current group (owner_person_id readiness is 100% per S3D).

## 5. Test matrix

| # | Scenario | Expected | Why |
| --- | --- | --- | --- |
| 1 | Existing owner renames group / changes default split | allowed | both branches of `is_group_owner` true; owner cols unchanged |
| 2 | Existing owner archives (`archived_at`) | allowed | same; `archived_at` is not an owner column |
| 3 | Existing owner deletes group | allowed | restrictive DELETE satisfied |
| 4 | Non-owner participant UPDATE or DELETE | denied | permissive `own groups` already fails; restrictive also fails |
| 5 | Outsider UPDATE/DELETE/SELECT | denied / 0 rows | no permissive policy matches |
| 6 | `createGroup` INSERT | allowed | INSERT untouched, legacy WITH CHECK |
| 7 | INSERT with someone else's `owner_user_id` | denied | `own groups` WITH CHECK `auth.uid() = owner_user_id` |
| 8 | Owner UPDATE sets `owner_user_id` to another user | denied | frozen-column clause in WITH CHECK |
| 9 | Owner UPDATE sets `owner_person_id` to another person | denied | frozen-column clause |
| 10 | Non-owner UPDATE trying to set themselves as owner | denied | fails both layers |
| 11 | `createGroup` rollback DELETE after member-insert failure | allowed | caller is `owner_user_id`, legacy branch true |
| 12 | Group/member/expense/settlement counts and balances | identical | SELECT and INSERT paths untouched, no data written |
| 13 | Invitation create / preview / claim / redeem | unchanged | invitations are governed by `group_invitations` policies and SECDEF functions; `claim`/`redeem` bypass RLS |
| 14 | `addGroupMembers`, `removeGroupMember`, member restore | unchanged | governed by `group_members` policies, not `groups` |

Verification method: run each write as the real owner (Jonas), as the non-owner participant (Zia) and as an unrelated identity, then re-run the count/balance baseline and diff it against the pre-migration snapshot.

## 6. Risks and rollback

- **Risk: double-owner-check confusion.** Both layers must pass, so an owner who somehow satisfies only the durable path (owner_user_id diverged) would be blocked on UPDATE/DELETE. Current data has zero such rows, so the risk is nil today; it is resolved when the legacy permissive policy is replaced in a later stage.
- **Risk: subselect cost.** Two single-row primary-key lookups per updated row — negligible at this scale.
- **Risk: an internal code path legitimately changing `owner_user_id`.** None exists in the app; transfer is explicitly deferred to an RPC.
- **Rollback:** `DROP POLICY "groups update must be group owner" ON public.groups;` and the DELETE equivalent. Purely definitional, no data rewritten.

## 7. Recommendation

Proceed with S3D-2 as **durable UPDATE/DELETE only**, plus the owner-column freeze, and keep INSERT on `own groups`. Ownership creation and transfer belong in S3D-3+ as a controlled SECURITY DEFINER RPC, after which the legacy permissive policy can be retired in one final step.

Read-only audit. Nothing implemented. S3D-3, S3D-4, S3E, S3F and S4 remain unstarted.
