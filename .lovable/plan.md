# Stage S3C-2 — People write-surface audit (read-only)

Nothing was changed. No policy, function, grant, constraint, column, row or app file was touched, and no test rows were created. S3D/S3E/S3F/S4 are not started.

## 1. Complete `public.people` schema

| Column | Type | Null | Default | Constraints | Written by app | Written by DB fn/trigger | In authorization | In financial/history relations |
|---|---|---|---|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK | never | never | indirectly (target of policies) | yes — referenced by group_members, expenses.paid_by_person_id, expense_splits, item_splits, settlements(from/to), activity.actor_person_id, group_invitations.person_id, groups.owner_person_id |
| `owner_user_id` | uuid | NO | none | FK → auth.users ON DELETE CASCADE | yes (insert only) | yes (`handle_new_user`, `redeem_group_invitation`, `accept_group_invitation`) | **yes — sole write key** (`own people`) | no |
| `linked_profile_id` | uuid | YES | none | FK → profiles ON DELETE SET NULL | insert only (self person) | yes (`claim_group_invitation` UPDATE; redeem/accept on insert) | yes — read side, via `is_group_participant` | no |
| `name` | text | NO | none | — | yes (insert, rename, profile-name sync) | yes (insert paths) | no | display only |
| `avatar_url` | text | YES | none | — | not written anywhere today | no | no | display only |
| `is_self` | boolean | NO | `false` | — | insert only | insert only | no (but drives client "me" resolution) | no |
| `status` | text | NO | `'active'` | CHECK in ('active','former') | never | never | no (not yet in any policy) | future lifecycle |
| `unlinked_at` | timestamptz | YES | none | — | never | never | no | future lifecycle |
| `created_at` | timestamptz | NO | `now()` | — | never | never | no | ordering only |

There is **no `updated_at` column** on `people` and no trigger on the table (`pg_trigger`: none non-internal).

## 2. Every write path to `people`

| Workflow | Caller | Op | Columns written | Authorization today | Expected user | SECURITY DEFINER |
|---|---|---|---|---|---|---|
| Signup | `handle_new_user()` trigger on auth.users | INSERT | owner_user_id, linked_profile_id, name, is_self=true | trigger, bypasses RLS | new account | yes |
| Self-person repair on load (`store.tsx` fetch) | browser | INSERT | owner_user_id, linked_profile_id, name, is_self=true | `own people` (uid = owner) | signed-in user | no |
| Guest migration (`migrateGuestData`) | browser | INSERT | owner_user_id, name, is_self, linked_profile_id | `own people` | converting guest | no |
| `addPerson` (placeholder) | browser | INSERT | owner_user_id, name | `own people` | creator | no |
| Group creation (`createGroup`) | browser | INSERT | owner_user_id, name | `own people` | group creator | no |
| `renamePerson` | browser | UPDATE | name | `own people` (creator only, **not** the linked user) | creator/group owner | no |
| `deletePerson` | browser | DELETE | — | `own people` | creator | no |
| Member removal cleanup (`groups` flow) | browser | DELETE | — | `own people`, only when unused, not self, not linked | group owner | no |
| Profile rename sync | browser (`updateProfile`) | UPDATE | name (on self person) | `own people` | the user | no |
| Invitation redeem (`redeem_group_invitation`, `accept_group_invitation`) | RPC | INSERT | owner_user_id (= group owner!), linked_profile_id (= joiner), name, is_self=false | function logic | joining user | yes |
| Invitation claim (`claim_group_invitation`) | RPC | UPDATE | linked_profile_id only | function logic, guarded | joining user | yes |

Note the asymmetry that matters for S3D: a person created by redeem is owned by the **group owner's** uid, while the linked account is the joiner's. That joiner today has **no write path at all** to their own person row.

## 3. Column write-classification matrix

| Column | Class | Mark | Why |
|---|---|---|---|
| `id` | D immutable | RED | Identity key of all financial history |
| `owner_user_id` | B owner/manager, system in practice | RED | The entire write-authorization key; self-editable = full takeover of any row |
| `linked_profile_id` | C system/lifecycle | RED | Account binding. Self-editable = claim any placeholder without an invitation, bypassing `claim_group_invitation` |
| `name` | A user-editable | GREEN for one's own linked person; YELLOW for placeholders (creator/group authority) | Display only, no authorization or money impact |
| `avatar_url` | A user-editable | GREEN | Display only, unused today |
| `is_self` | D immutable | RED | Determines "me" resolution in the client; flipping it corrupts split defaults |
| `status` | C lifecycle | RED | Will gate claimability and former-person behaviour; self-edit would let a former person re-activate |
| `unlinked_at` | C lifecycle | RED | Same as status; must be set only by controlled deletion/unlink logic |
| `created_at` | D immutable | RED | Audit ordering |

## 4. Self-person lifecycle

Signup → `handle_new_user` writes `profiles` + a self `people` row with the same name. Profile editing (`updateProfile`) writes `profiles` **and** mirrors `display_name` into the self person's `name`. Editing a person's name (`renamePerson`) does **not** write back to `profiles`. So the two can diverge: rename the self person from a group screen and `profiles.display_name` stays stale. Canonical today is `profiles` for the account, while `people.name` is what every group screen and balance list actually displays. `people` is currently used as a live mirror, not a historical snapshot — but only in the one direction profile → person.

## 5. Placeholder lifecycle

| Transition | Columns touched | Who should be allowed |
|---|---|---|
| Create placeholder | owner_user_id, name | creator |
| Rename | name | creator or group owner |
| Add to group | none on `people` (writes `group_members`) | group owner |
| Used in expense/split | none on `people` | any participant |
| Invite | none on `people` (writes `group_invitations.person_id`) | group owner |
| Claim | linked_profile_id | controlled RPC only |
| Future unlink/former | status, unlinked_at, linked_profile_id | controlled RPC only |

## 6. Invitation claim path

`claim_group_invitation(_code)` is `SECURITY DEFINER`, `search_path=public`. On the person-scoped branch it writes exactly one column: `people.linked_profile_id = auth.uid()`, guarded by `AND linked_profile_id IS NULL`, plus `group_invitations.status='used', revoked_at=now()`. It never touches owner_user_id, is_self, status or unlinked_at, and never writes `group_members` on that branch (the person is already a member). The group-wide branch delegates to `redeem_group_invitation`, which INSERTs a new person owned by the group owner and INSERTs `group_members`.

Guards preventing the wrong person being claimed: the person is read from the invitation row, never from the client; the person must belong to the invitation's group; the person must be unlinked (else `person_taken`); the caller must not already be another person in the group; invitation must be active, unrevoked and unexpired. Client code cannot reach these columns at all today because `own people` requires `auth.uid() = owner_user_id`, which the joiner is not.

## 7. Current privileges

RLS policies on `people` (2, both PERMISSIVE, role `authenticated`):
- `own people` — FOR ALL, USING and WITH CHECK `auth.uid() = owner_user_id`
- `participants can read group people` — FOR SELECT, USING: exists a `group_members` row for the person in a group where `is_group_participant(gm.group_id, auth.uid())`

Table ACL: `anon`, `authenticated`, `service_role` all hold full `arwdDxtm` (including UPDATE). There are **no column-level grants** on any column (`pg_attribute.attacl` is null for all nine). Therefore RLS alone decides which rows may change, and **nothing** restricts which columns change.

**Risk of the proposed broad policy.** A policy `FOR UPDATE USING (linked_profile_id = auth.uid()) WITH CHECK (linked_profile_id = auth.uid())` would, under these grants, let the linked user rewrite **every column of that row in one statement**: set `owner_user_id = auth.uid()` (stealing the row and all `own people` authority over it, including delete), flip `is_self`, set `status='active'` on a former person, clear `unlinked_at`, or rewrite `name`. The WITH CHECK only pins `linked_profile_id`; every other column is unconstrained. That is why S3C-1 correctly deferred it.

## 8. Recommended smallest safe self-management mechanism

- **A. broad self UPDATE policy** — rejected, see above.
- **B. row policy + column-level UPDATE grants** (`GRANT UPDATE (name, avatar_url) ON public.people TO authenticated`) — sound, but column grants apply to *all* update paths for that role, so they would also silently narrow the existing `own people` creator path (rename of placeholders). Requires revoking the table-wide UPDATE grant, which is a wider blast radius than it looks.
- **C. narrow SECURITY DEFINER RPC** e.g. `update_self_person_display(_name text, _avatar_url text)` that updates only `name`/`avatar_url` where `linked_profile_id = auth.uid() AND status='active'` — smallest writable surface, no new row-level UPDATE authority, matches the existing invitation-claim pattern already in the codebase.
- **D. keep self-editable data in `profiles`** — attractive long term, but the group UI reads `people.name`, so the mirror still has to be written by something.

**Recommendation: C, plus keeping the existing profile → person name mirror.** It grants zero new direct UPDATE rights and cannot touch a security or lifecycle column by construction.

## 9. Before `people.owner_user_id` may become NULL

1. A non-owner write path must exist for every workflow in section 2 that currently relies on `own people`: rename (group-authority anchored, e.g. `is_group_owner` over a group the person belongs to), delete/cleanup, and self display edits (mechanism C).
2. Read access for a person's own row must not depend on `owner_user_id` — add a self-read path via `linked_profile_id = auth.uid()`; group reads already work through `participants can read group people`.
3. Placeholder creation needs an anchor other than the creator's uid (group-scoped insert, or `owner_person_id`).
4. Personal (non-group) people rows must keep an owner — they have no group anchor at all, so either keep `owner_user_id NOT NULL` for them or add a CHECK equivalent to the S3C-1 expense invariant.
5. The FK must move from `ON DELETE CASCADE` to `ON DELETE SET NULL`, otherwise deleting the account still destroys shared history regardless of nullability.
6. `status='former'` semantics must be defined and enforced before claim/read policies can depend on them.

## 10. Table readiness marks

- `people` — **RED**: `owner_user_id` is still the only write key and the FK still cascades.
- `profiles` — GREEN.
- `group_members`, `groups`, `group_invitations` — YELLOW (owner-keyed writes, group anchor available).

## 11. Proposed S3C-2 implementation

None in this stage — this is the audit. The follow-on stage (S3C-3, only on approval) would be a single additive migration: a `people` SELECT policy for `linked_profile_id = auth.uid()`, plus the `update_self_person_display` SECURITY DEFINER function with `EXECUTE` granted to `authenticated` only. No existing policy, grant, FK or column changes.

## 12. Regression tests for that future implementation

Self read of own linked person; group participant reads unchanged; creator rename still works; RPC changes only name/avatar and returns the row; RPC refuses a person the caller is not linked to; RPC cannot change owner_user_id/linked_profile_id/is_self/status/unlinked_at (verified by column-level before/after diff); outsider blocked from all of the above; invitation preview/claim unchanged; counts and per-group balances bit-identical.

## 13. Rollback plan

Drop the new policy and drop the new function; nothing else would have changed, so rollback is two statements and restores the exact current state.

## Regression baseline recorded (unmodified)

people 10 — status active 10, former 0; is_self true 4 / false 6; linked 4 / unlinked 6. group_members 5. Public-schema policies 45, of which 2 on `people` (definitions in section 7). Functions relevant to `people`: `handle_new_user`, `claim_group_invitation`, `redeem_group_invitation`, `accept_group_invitation`, `get_invitation_preview`, `is_group_participant` — all unchanged.
