# Stage S3D — Group ownership and placeholder-management audit (read-only)

No database, policy, function or application file was changed. Everything below comes from live queries against the database and from reading the app code.

## 1. Current group ownership model — YELLOW

- `groups.owner_user_id` is the only authorization key today. Policy `own groups` (PERMISSIVE, ALL, authenticated) is `auth.uid() = owner_user_id` for both USING and WITH CHECK.
- `groups.owner_person_id` exists and is fully backfilled, but **no policy, function or app code reads it** — it is currently metadata only.
- `group_members.role` already holds `owner` / `member`, but nothing authorizes on it; it is display/creation metadata only.
- `is_group_participant()` grants read access (groups, group_members, people-in-group).
- `is_group_owner()` is used only in the three RESTRICTIVE `group_members` write policies.

Effective answers to "who may…":

| Question | Today's answer | Enforced by |
| --- | --- | --- |
| Owns a group | `owner_user_id = auth.uid()` | `groups` ALL policy |
| Edit name/settings | Same | `groups` ALL policy |
| Add/remove members | `is_group_owner(group_id, auth.uid())` **and** `auth.uid() = group_members.owner_user_id` | 1 permissive + 3 restrictive policies |
| Create/revoke invitations | `auth.uid() = group_invitations.owner_user_id` | `own group invitations` ALL policy |
| Rename/delete placeholders | `auth.uid() = people.owner_user_id` | `own people` ALL policy |
| Delete/archive group | `auth.uid() = groups.owner_user_id` | `groups` ALL policy |

## 2. Group/admin write paths

| Workflow | Caller | Tables | Op | Columns | Authorization today | owner_user_id | is_group_owner | is_group_participant | Path | SECDEF |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| createGroup | store.tsx | groups | INSERT | owner_user_id, name, default_split_type, currency | own groups | yes | no | no | direct | no |
| createGroup members | store.tsx | people, group_members | INSERT | owner_user_id, group_id, person_id, role, defaults | own people + own group_members + restrictive owner check | yes | yes | no | direct | no |
| updateGroup | store.tsx | groups, group_members | UPDATE | name, default_split_type, default_percentage, default_weight | own groups / owner check | yes | yes | no | direct | no |
| addGroupMembers / restore | store.tsx | group_members | INSERT/UPDATE | group_id, person_id, role, removed_at | owner check | yes | yes | no | direct | no |
| removeGroupMember | store.tsx | group_members, people | UPDATE(removed_at) or DELETE + optional people DELETE | removed_at | owner check + own people | yes | yes | no | direct | no |
| setGroupArchived | store.tsx | groups | UPDATE | archived_at | own groups | yes | no | no | direct | no |
| deleteGroup | store.tsx | many + groups | DELETE | — | own groups / own rows | yes | no | no | direct | no |
| addPerson / renamePerson / deletePerson | store.tsx | people | INSERT/UPDATE/DELETE | name | own people | yes | no | no | direct | no |
| own display name | store.tsx | people | UPDATE | name | own people (RPC `update_my_people_name` exists but app still writes directly) | yes | no | no | direct | RPC available |
| ensureGroupInvitation | invitations.ts | group_invitations | SELECT/INSERT | group_id, owner_user_id, person_id, token, join_code | own group invitations | yes | no | no | direct | no |
| markInvitationSent / revokeInvitation | invitations.ts | group_invitations | UPDATE | sent_at, revoked_at, status | own group invitations | yes | no | no | direct | no |
| preview / claim | invitations.ts | — | — | — | token-driven, public | in function bodies | no | no | RPC | yes |

## 3. Placeholder-management matrix

| Workflow | Today | Recommended future authority |
| --- | --- | --- |
| Create placeholder | people INSERT by `owner_user_id` | Group owner, via group-scoped RPC/policy |
| Rename placeholder | people UPDATE by `owner_user_id` | Group owner (unclaimed only) |
| Rename own linked person | direct UPDATE (RPC exists) | Linked user only — route through `update_my_people_name` |
| Add placeholder to group | group_members INSERT, owner-checked | Group owner |
| Remove placeholder from group | soft `removed_at` if history, else hard delete | Group owner; keep soft rule |
| Delete unused placeholder | people DELETE by owner | Group owner, only when unclaimed and unreferenced |
| Invite placeholder | person invitation by owner | Group owner |
| Claim placeholder | `claim_group_invitation` (SECDEF, token) | Unchanged — token-driven |

Participants must **not** gain placeholder-management rights; current product behaviour gives them read-only access.

## 4. owner_person_id readiness — GREEN

Across 2 groups: 0 null, 0 mismatched against `owner_user_id`, 0 non-active owner persons, 0 owners missing an active membership row. Every owner person is linked to a profile. Coverage is complete, so a durable owner check would be behaviour-identical today.

## 5. is_group_owner migration analysis — YELLOW

Current definition: `EXISTS (SELECT 1 FROM groups g WHERE g.id = _group_id AND g.owner_user_id = _user_id)`, SQL STABLE SECURITY DEFINER, `search_path = public`, executable by authenticated (and flagged by the linter for authenticated exposure).

A future version can safely OR in the durable path `groups.owner_person_id -> people.linked_profile_id = auth.uid()` — with the data above it changes nothing for existing groups. Edge rules to encode:

- `owner_person_id` NULL → fall back to `owner_user_id`; if both absent the group is orphaned and admin actions are denied.
- Owner person `former` → not an owner (deny).
- Owner person removed from group → not an owner (deny).
- Owner person unlinked (`linked_profile_id` null) → not an owner; group is orphaned and needs transfer.

## 6. Role/admin model — recommend option A

`group_members.role` already exists with values `owner` and `member` but carries no authority. There is no product surface for multiple admins. Recommendation: **A — `owner_person_id` only**, keeping `role` as descriptive metadata. Option B (owner + admin) can be added later without migration pain; option C (permissions table) is unjustified at this size.

## 7. Invitation authority — YELLOW

- Create / resend (`sent_at`) / revoke: require `group_invitations.owner_user_id = auth.uid()`. This is the only guard — it does **not** currently verify the caller owns the target group.
- Preview / redeem / claim: SECURITY DEFINER, token-driven, intentionally public. `claim_group_invitation` and `redeem_group_invitation` read `groups.owner_user_id` to attribute newly created people rows — a hard dependency to resolve in a later stage.

## 8. Member removal — GREEN on history safety

- Only the group owner may write `group_members` (restrictive policies).
- App blocks the owner removing themselves (`owner-self`).
- The owner can remove another linked member; a user cannot remove themselves.
- If the person has any group history, the row is soft-removed (`removed_at`); expenses, splits and settlements are untouched.
- A hard delete of the `people` row happens only when the person is a placeholder, unlinked, not `is_self`, and referenced nowhere.

## 9. Ownership-transfer design (not implemented)

Smallest safe model for a later stage: an explicit `transfer_group_ownership(_group_id, _successor_person_id)` SECURITY DEFINER RPC callable only by the current owner, which sets `owner_person_id` (and, while transitional, `owner_user_id`) after validating the successor is an active, non-removed, linked member. Deterministic fallback at deletion time: oldest active linked member; if none exists, set `orphaned_at` and leave history intact. Never transfer to an unclaimed placeholder or a `former` person. Current owner stays authoritative until an approved stage flips the predicate.

## 10. RLS dependency matrix

| Table | SELECT | INSERT | UPDATE | DELETE | owner_user_id dependence |
| --- | --- | --- | --- | --- | --- |
| groups | `own groups` (ALL, perm) + `participants can read groups` (perm) | own groups | own groups | own groups | RED |
| group_members | `own group members` (ALL, perm) + participants read | perm owner row + RESTRICTIVE `is_group_owner` | same | same | YELLOW |
| people | `own people` (ALL) + participants-in-group read + `self linked people read` | own people | own people | own people | RED |
| group_invitations | `own group invitations` (ALL, perm) | same | same | same | RED |

Grants: all four tables carry SELECT/INSERT/UPDATE/DELETE for `anon`, `authenticated` and `service_role`, but every policy targets `authenticated` only, so `anon` is fully blocked by RLS. Worth tightening the `anon` grants in a later hardening pass.

## 11. Proposed S3D sub-stages (not implemented)

**S3D-1 — durable owner helper.** Replace `is_group_owner` body with `owner_user_id = _user_id OR (owner_person_id -> people.linked_profile_id = _user_id AND status='active' AND active membership)`. Behaviour-identical on current data. Risk: none measurable; rollback = restore prior body.

**S3D-2 — group-management write policies.** Add owner-scoped INSERT/UPDATE/DELETE policies on `groups` using `is_group_owner(id, auth.uid())` alongside the existing `own groups`, so ownership survives without `owner_user_id`. Risk: double-permissive widening — mitigate with a restrictive parent check. Rollback = drop new policies.

**S3D-3 — placeholder management.** Add group-scoped write authority for unclaimed people rows (`is_group_owner` over a membership join) plus a `rename_group_person` SECDEF RPC restricted to unclaimed persons in a group the caller owns. Risk: recursion between people and group_members — mitigate with SECURITY DEFINER helpers as done for `can_read_expense_item`. Rollback = drop policy/RPC.

**S3D-4 — invitation authority.** Move invitation writes from `owner_user_id = auth.uid()` to `is_group_owner(group_id, auth.uid())`, and make `claim/redeem` attribute new people rows via `owner_person_id` instead of `owner_user_id`. Risk: breaks invite creation if a legacy invitation's `owner_user_id` diverges from the group owner — verify first. Rollback = restore prior policy and function bodies.

## 12. Regression tests for each sub-stage

Owner can edit group name, archive, add/remove members, create/revoke/resend invitations; non-owner participant can read but not write; outsider sees nothing; placeholder rename by owner works, by participant fails; claimed person cannot be renamed by the owner; claim/redeem still returns `joined` / `claimed` / `already_member`; balances byte-identical before and after each migration.

## 13. Rollback strategy

Each sub-stage is a single migration touching one concern: restore the previous function body (S3D-1, S3D-4 functions) or drop the newly added policies/RPC (S3D-2, S3D-3). No data is rewritten in any sub-stage, so rollback is purely definitional.

## Status marks

- Group ownership model — YELLOW
- owner_person_id data readiness — GREEN
- is_group_owner — YELLOW
- Member removal / history safety — GREEN
- Placeholder management — RED
- Invitations — RED
- groups table RLS — RED
- group_members RLS — YELLOW
- people RLS — RED

Nothing was implemented. S3E, S3F and S4 have not been started.
