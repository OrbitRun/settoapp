# Stage S3D-3 — Atomic group creation + ownership transfer (audit only)

Read-only. Nothing changed. Based on the live policy/function catalog and `src/data/store.tsx` (`createGroup` lines 976–1048, `updateGroup`, `addGroupMembers`, `removeGroupMember`, `deleteGroup`).

## 1. Current client-side creation sequence

```text
1. INSERT groups            (owner_user_id = auth.uid(), owner_person_id NULL)
2. INSERT people            (one per new name, owner_user_id = auth.uid())
3. INSERT group_members     (owner row first, role 'owner'; rest 'member')
4. on member failure        DELETE groups   (partial rollback)
5. logActivity('group_created') + refresh()
```

Weaknesses this stage must remove:

- Not atomic. A failure at step 2 leaves orphan `people` rows behind; a failure at step 3 deletes the group but the people rows created in step 2 survive. Step 5 is fire-and-forget.
- `owner_person_id` is never set on creation, so every new group is born legacy-only and depends on `owner_user_id` for authority.
- Person creation requires the caller to own `people.owner_user_id`, so creation authority and personal-data ownership are entangled.
- `currentPersonId` is resolved on the client; if it is missing, the group is created with no owner membership row at all.

## 2. Proposed `create_group` RPC (design)

```text
public.create_group(
  _name text,
  _default_split_type text,
  _currency text,
  _person_names text[],
  _percentages jsonb default '{}',
  _shares jsonb default '{}'
) returns uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
```

Behaviour, in one transaction (a function body is a single implicit transaction — any RAISE rolls back everything it wrote):

1. Reject when `auth.uid()` is NULL.
2. Validate: trimmed name non-empty (fallback to a default), `_default_split_type` in ('equal','percentage','shares'), currency a 3-letter code, `_person_names` length capped (e.g. 50).
3. Resolve the caller's own person: the active row with `linked_profile_id = auth.uid()`, preferring `is_self`. If none exists, create it (`owner_user_id = auth.uid()`, `linked_profile_id = auth.uid()`, `is_self = true`, name from `profiles.display_name`). This removes the client's `currentPersonId` dependency.
4. INSERT the group with `owner_user_id = auth.uid()` and `owner_person_id = <caller person>` **in the same statement** — the group is durable from birth.
5. For each supplied name: reuse an existing person owned by the caller with a case-insensitive name match, otherwise create a placeholder (`owner_user_id = auth.uid()`, no linked profile).
6. INSERT `group_members` for the owner (role 'owner') and every other person (role 'member'), applying `default_percentage` / `default_weight` from the jsonb maps keyed as today ('self' + lowercased name).
7. INSERT the `group_created` activity row inside the same transaction.
8. Return the group id.

Grants: `REVOKE ALL FROM PUBLIC, anon`; `GRANT EXECUTE TO authenticated` (plus `service_role`). SECURITY DEFINER with a pinned `search_path`, and every write keyed off `auth.uid()` only — no caller-supplied owner id anywhere in the signature, so the RPC cannot be used to create a group on someone else's behalf.

### Rollback semantics

All-or-nothing. Any validation failure or constraint violation raises, and Postgres discards the group, the people, the memberships and the activity row together. No compensating DELETE and no orphan `people` rows — strictly better than today's step-4 partial rollback. The client sees a single error and shows the existing "kunne ikke gemme" toast.

### Why RLS does not need to change

The RPC is SECURITY DEFINER, so it bypasses the `groups` INSERT policy entirely. The legacy permissive `own groups` INSERT path can stay exactly as it is during the transition and be retired only in S3D-4 once no client writes `groups` directly.

## 3. Proposed `transfer_group_ownership` RPC (design)

```text
public.transfer_group_ownership(_group_id uuid, _successor_person_id uuid) returns void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
```

Guards, all raising a distinct error message:

1. `auth.uid()` is not NULL.
2. `public.is_group_owner(_group_id, auth.uid())` is TRUE — only the current owner may transfer.
3. The successor person exists, `status = 'active'`, `unlinked_at IS NULL`.
4. The successor is **linked** (`linked_profile_id IS NOT NULL`) — placeholders can never own a group.
5. The successor has a `group_members` row in this group with `removed_at IS NULL`.
6. The successor is not already the owner (no-op / idempotent success).

Effects, one transaction:

- `groups.owner_person_id = _successor_person_id`
- `groups.owner_user_id = successor.linked_profile_id` (see §4)
- `group_members.role`: successor → 'owner', previous owner person → 'member'
- `groups.orphaned_at = NULL`
- one `activity` row recording the transfer

The RESTRICTIVE freeze policy from S3D-2 does not block this: `group_owner_fields_unchanged` is only consulted in the policy layer, and SECURITY DEFINER writes bypass RLS. That is exactly the escape hatch the freeze was designed to leave open.

## 4. How `owner_user_id` is maintained during the transition

Keep it, keep it in sync, stop relying on it:

- **Phase now (S3D-3):** `owner_person_id` becomes authoritative for authorization (already true via `is_group_owner`), while `owner_user_id` is maintained as a mirror of `owner_person_id`'s linked account. Both RPCs write them together so they can never diverge.
- **Phase S3D-4:** the legacy branch of `is_group_owner` and the permissive `own groups` policy are replaced by durable equivalents; `owner_user_id` becomes pure creator metadata.
- **Phase S4:** `owner_user_id` becomes nullable on `groups` so account deletion no longer needs to touch shared rows.

Until then no code path other than these two RPCs may write either column — the S3D-2 freeze already enforces that from the client side.

## 5. Deterministic fallback rules for future account deletion

Not implemented here; specified so S4 has no open decisions. When the owner's account is deleted (their person becomes `status = 'former'`, `unlinked_at` set, `linked_profile_id` cleared):

1. If another **linked, active, non-removed** member exists, ownership passes to the one with the earliest `joined_at` (tie-break: lowest person id). Deterministic and reproducible.
2. If none exists, `owner_person_id` stays pointing at the former owner's person row, `owner_user_id` is set NULL and `orphaned_at = now()`. The group becomes read-only for remaining members; history survives intact.
3. An orphaned group is reclaimed automatically by the same rule as (1) the first time a member links an account, or explicitly by the first linked member calling a future `claim_orphaned_group` RPC.
4. Never delete a group as part of account deletion, and never let the FK do it — `owner_person_id` is already `ON DELETE SET NULL`.

## 6. Frontend write audit and smallest migration path

| Path | Writes today | S3D-3 change |
| --- | --- | --- |
| `createGroup` (store.tsx 976–1048) | groups, people, group_members, activity | replaced by a single `create_group` RPC call returning the id, then `refresh()` |
| `groups.new.tsx` | calls `pari.createGroup` only | none — signature unchanged |
| `split.result.tsx` "save as group" | same `createGroup` | none |
| `updateGroup`, `addGroupMembers`, `removeGroupMember`, `setGroupArchived`, `deleteGroup` | direct table writes | untouched in S3D-3 |
| ownership transfer | does not exist in the UI | RPC only; no UI in this stage |

Smallest path: keep `CreateGroupInput` and the `Promise<string | null>` contract exactly as-is, so `createGroup` becomes a ~10-line `supabase.rpc('create_group', {...})` wrapper and no calling component changes. That is a one-file frontend diff, and the old code path can be restored by reverting that one function.

## 7. Test matrix for the eventual implementation

| # | Scenario | Expected |
| --- | --- | --- |
| 1 | Create group with 2 new names | group + 3 members + people created; `owner_person_id` set |
| 2 | Create group reusing an existing person by name | no duplicate person |
| 3 | Create group as a user with no self person | self person created, becomes owner |
| 4 | Percentage / shares defaults supplied | landed on the right member rows |
| 5 | Forced failure mid-way | zero rows in groups, people, group_members, activity |
| 6 | anon calls `create_group` | permission denied |
| 7 | Owner transfers to a linked active member | owner columns + roles swapped, activity logged |
| 8 | Transfer to a placeholder / removed / inactive person | denied |
| 9 | Non-owner participant or outsider calls transfer | denied |
| 10 | Transfer to the current owner | idempotent no-op |
| 11 | Client tries to change owner columns directly | still 403 (S3D-2 freeze intact) |
| 12 | Counts and balances after all tests | bit-identical to baseline |

## 8. Risks

- **Two SECURITY DEFINER functions added** → linter warning count rises by two; both are auth-gated and revoked from `anon`.
- **jsonb split-rule keys** ('self' + lowercased name) are a client convention; the RPC must reproduce it exactly or defaults silently land wrong. Covered by tests 4.
- **Name-matching person reuse** is case-insensitive and scoped to the caller's own people, matching current behaviour; it does not reuse other users' people.

Read-only audit. Nothing implemented. S3D-4, S3E, S3F and S4 remain unstarted.
