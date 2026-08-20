# Stage S3A — Authorization readiness audit (read-only)

No policy, function, grant, data, FK, auth or UI change was made. Findings come from reading all 30 live RLS policies, the 9 database functions, the data layer (`src/data/store.tsx`, `src/data/invitations.ts`, `src/data/guest.ts`) and live row counts.

## 1. Authorization dependency matrix

| Table | SELECT | INSERT | UPDATE | DELETE | Depends on owner_user_id | Uses participant/owner checks | Status |
|---|---|---|---|---|---|---|---|
| people | own (creator) + participant-of-shared-group read | creator only | creator only | creator only | Yes — sole write path | read only | RED |
| groups | participant read + creator ALL | creator only | creator only | creator only | Yes — sole write path | `is_group_participant` (read) | RED |
| group_members | participant read + creator ALL | restrictive `is_group_owner` AND creator | same | same | Yes — permissive layer still creator | `is_group_owner` | RED |
| expenses | participant read + creator ALL | restrictive participant AND creator | same | creator only | Yes for write/delete | `is_group_participant` | YELLOW |
| expense_items | shared/own-item participant read + creator ALL | creator only | creator only | creator only | Yes — no participant write path | read only | RED |
| expense_splits | participant read + creator ALL | creator only | creator only | creator only | Yes — no participant write path | read only | RED |
| item_splits | `can_read_expense_item` read + creator ALL | creator only | creator only | creator only | Yes — no participant write path | `can_read_expense_item` | RED |
| settlements | participant read + creator ALL | restrictive participant AND creator | same | creator only | Yes for write/delete | `is_group_participant` | YELLOW |
| activity | participant read + creator ALL | restrictive participant AND creator | same | creator only | Yes for write/delete | `is_group_participant` | YELLOW |
| group_invitations | creator ALL only | creator only | creator only | creator only | Yes — everything | none (RPCs are SECURITY DEFINER) | RED |
| profiles | keyed on `auth.uid() = id` | same | same | same | n/a | n/a | GREEN (no owner_user_id) |
| fx_rates | authenticated read; writes revoked | — | — | — | No | No | GREEN |

Key structural fact: on every group-scoped table the only PERMISSIVE write policy is `auth.uid() = owner_user_id`. The participant policies added earlier are either SELECT-only or RESTRICTIVE. RESTRICTIVE policies narrow access, they never grant it — so if `owner_user_id` became NULL today, **all writes would fail on every table**, and reads would survive only where a participant SELECT policy exists.

## 2. Remaining dependencies on owner_user_id

Database:
- 10 permissive `ALL` policies keyed on `auth.uid() = owner_user_id` (one per table above).
- No function reads `owner_user_id` for authorization except `is_group_owner` and `is_group_participant`, which read `groups.owner_user_id`. `redeem_group_invitation`, `claim_group_invitation`, `accept_group_invitation` and `get_invitation_preview` all read `groups.owner_user_id` / `group_invitations.owner_user_id` to attach new people to the owner.
- `handle_new_user` writes `people.owner_user_id = NEW.id`.

Application (`src/data/store.tsx`, `src/data/invitations.ts`):
- `owner_user_id: userId` is set on every insert: people, groups, group_members, expenses, expense_items, expense_splits, activity, settlements, invitations, plus the whole guest-migration path.
- No client query filters by `owner_user_id`; `fetchAll` selects `*` and relies entirely on RLS. That is good — reads need no client change.
- One client-side self check reads `person.owner_user_id === userId && person.is_self` when bootstrapping the "me" person.

Classification: `groups.owner_user_id` and `group_members` writes are **A (authorization-critical)**. `expenses/expense_items/expense_splits/item_splits/settlements/activity.owner_user_id` are **B (creator/audit metadata)** by intent but currently load-bearing as the only write grant. `people.owner_user_id` is **C (personal-data ownership)**. `group_invitations.owner_user_id` is **D (transitional)** — the RPCs are SECURITY DEFINER and do not need it for access, only for choosing which account new people hang off.

## 3. Shared group data gaps

For group-scoped rows (group_id NOT NULL):

- READ: already fully authorized without owner_user_id on expenses, expense_splits, settlements, activity, group_members, groups, people-in-group, expense_items and item_splits. No gap.
- CREATE: only expenses, settlements and activity have a participant-aware INSERT layer, and it is RESTRICTIVE, so even those still require the creator match to pass. Gap on all six.
- EDIT: same shape — participant UPDATE exists (restrictive) on expenses, settlements, activity; nothing at all on expense_items, expense_splits, item_splits. Gap on all six.
- DELETE: no participant DELETE policy exists anywhere. Deletes are creator-only on all six. This matters because editing an expense deletes and reinserts `expense_splits`, and deleting an expense deletes items and splits.

## 4. Personal / non-group data

Rows that can exist with `group_id IS NULL`: `expenses` (guest migration inserts them explicitly with `group_id: null`), their `expense_items`, `expense_splits`, `item_splits`, and `activity`. Live data today: 0 personal expenses, 16 personal activity rows.

- Owned and read purely via `auth.uid() = owner_user_id`. There is no participant SELECT fallback — the participant read policies all require `group_id IS NOT NULL` (or, for children, a parent with a group).
- Edited/deleted the same way.
- So yes: for personal data `owner_user_id` is currently the **only** durable authorization path. It is genuinely category C here, not metadata.

Safe future model (not to be implemented now): keep `expenses.owner_user_id` NOT NULL for personal rows and authorize personal data through the durable self-person instead — i.e. a helper that resolves `people.linked_profile_id = auth.uid()` and matches `paid_by_person_id` / split membership, so a personal expense stays reachable through the person rather than the auth user. Personal data belongs to exactly one account by definition, so account deletion should delete it rather than orphan it — meaning `owner_user_id` should stay non-nullable on the personal path even after shared data is relaxed.

## 5. People identity / authorization gaps

Current: 10 people, all `status = 'active'`, 6 with no `linked_profile_id` (placeholders).

- Personal/self person: created by `handle_new_user` with `owner_user_id = NEW.id`, `is_self = true`. Client bootstrap also matches on `owner_user_id`.
- Group placeholder: created under the group owner's `owner_user_id`; only that owner can rename or delete it.
- Claimed group person: `claim_group_invitation` sets `linked_profile_id = auth.uid()` but leaves `owner_user_id` on the inviter. So a claimed member **cannot edit their own name** — the owner still holds write rights. This is an existing product gap, independent of deletion.
- Former person: `status`/`unlinked_at` exist (S1) but nothing reads them yet.

Assessment: `people.owner_user_id` cannot become pure creator metadata yet. Placeholders have no other durable owner, so relaxing it without first adding a group-scoped write path (owner of the group that the person belongs to) would strand them as uneditable and undeletable.

## 6. Group administration gaps

- Owner detection: `is_group_owner(group_id, uid)` reads `groups.owner_user_id` only. `is_group_participant` reads `groups.owner_user_id` OR an active `group_members` row joined to a linked person.
- Roles: `group_members.role` exists (`member` / owner-ish) but no policy or function reads it. It is currently decorative.
- Editing a group, archiving, deleting: all go through the creator-only `own groups` policy.
- Adding/removing members: restrictive `is_group_owner` plus the creator policy; removal is soft (`removed_at`) when history exists, hard delete otherwise, decided client-side.
- `groups.owner_person_id` (S2) is backfilled 2/2 but read by nothing.

Must change before `groups.owner_user_id` can be nullable: `is_group_owner` needs to resolve ownership through `owner_person_id` → `people.linked_profile_id`; `is_group_participant` needs the same fallback; the `own groups` and `own group_members` write policies need a person-based equivalent; and `group_members.role = 'owner'` should become the real admin signal so a group can survive with no owner user at all.

## 7. Invitation dependencies

- Creation: client inserts into `group_invitations` with `owner_user_id = userId`; the only policy is creator-ALL, so **only the group's creator account can create or revoke invitations** — a co-admin cannot.
- Preview/redeem/claim: all four RPCs are SECURITY DEFINER and bypass RLS, so they do not need the caller to own anything. But their bodies use `groups.owner_user_id` to decide which account newly created people hang off (`people.owner_user_id = v_group.owner_user_id`) and `redeem_group_invitation` treats `v_group.owner_user_id = auth.uid()` as "already a member".
- Later they must attach new people to the group (via `owner_person_id` / group membership) rather than to the owner account, and derive owner-equivalence from `is_group_owner` rather than a direct column compare.

## 8. Expense child tables

`addExpense` inserts expense → expense_splits → expense_items, each carrying `owner_user_id`. `updateExpense` deletes all `expense_splits` for the expense and reinserts them. `deleteExpense` deletes splits, then items, then the expense. Group deletion deletes splits/items/expenses/settlements/activity/invitations/members/group in sequence.

Every one of those child writes is authorized *only* by `auth.uid() = owner_user_id`. This is exactly the dangerous future state named in the request: with a NULL creator the parent expense stays readable and editable (participant restrictive + a future participant permissive policy) while its items and splits become uneditable — producing half-written expenses. Child tables therefore need their participant write path **before** any creator ID is relaxed.

`can_read_expense_item` remains structurally compatible: it derives identity from `auth.uid()` via `people.linked_profile_id` and `is_group_participant`, never from `owner_user_id`, and it is SECURITY DEFINER + STABLE so adding participant write policies on `item_splits` will not reintroduce recursion as long as new policies call the helper rather than querying `item_splits` inline.

## 9. Tables already safe for a future nullable creator ID

None are fully GREEN among the group tables. `profiles` (no such column) and `fx_rates` (no creator concept, writes revoked) are safe. Closest to ready are `expenses`, `settlements` and `activity` — reads and a participant guard already exist; they only lack permissive participant write policies.

## 10. Tables NOT safe yet

`people`, `groups`, `group_members`, `expense_items`, `expense_splits`, `item_splits`, `group_invitations` — RED. `expenses`, `settlements`, `activity` — YELLOW.

## 11. Proposed S3 sub-stages (safest order, one migration each)

**S3B — shared financial child-table write readiness**
- Tables: `expense_items`, `expense_splits`, `item_splits`.
- Concept: add PERMISSIVE INSERT/UPDATE/DELETE policies gated on the parent expense being group-scoped and `is_group_participant(e.group_id, auth.uid())`; for `item_splits` reuse `can_read_expense_item` rather than inline subqueries.
- Expected behaviour: no visible change today (creator policies still match); participants gain the ability to edit shared expense internals.
- Risks: widening edit rights to all participants; recursion if the item_splits policy is written inline.
- Rollback: drop the new policies; the creator policies are untouched.

**S3C — shared parent write readiness**
- Tables: `expenses`, `settlements`, `activity`.
- Concept: add PERMISSIVE participant INSERT/UPDATE policies and a participant DELETE policy so the restrictive layer stops being the only participant reference; leave the restrictive policies in place.
- Expected behaviour: unchanged today; group-scoped rows become editable without the creator match.
- Risks: participant DELETE is the widest new right — may need to stay owner-only.
- Rollback: drop the new policies.

**S3D — people ownership readiness**
- Tables: `people`; functions: none changed yet.
- Concept: add a write path for people through the group they belong to (group owner may edit placeholders) and through `linked_profile_id = auth.uid()` (a claimed person may rename themselves); teach the client self-lookup to prefer `linked_profile_id`.
- Expected behaviour: claimed members can edit their own name; placeholders remain owner-managed.
- Risks: a person in multiple groups becomes editable by several owners.
- Rollback: drop the new policies; client fallback is additive.

**S3E — group administration on owner_person_id**
- Tables: `groups`, `group_members`; functions `is_group_owner`, `is_group_participant`.
- Concept: extend both helpers to also resolve ownership via `groups.owner_person_id → people.linked_profile_id` and via `group_members.role = 'owner'`; add person-based permissive write policies on groups/group_members. `owner_user_id` stays authoritative and is only OR-ed, never replaced.
- Expected behaviour: identical authorization results today (owner_person_id points at the owner's own person), with a second durable path.
- Risks: highest — these helpers gate every table. Requires a full balance/visibility regression pass.
- Rollback: restore the previous function bodies (kept verbatim in the migration comment) and drop the new policies.

**S3F — invitation readiness**
- Tables: `group_invitations`; functions `redeem_group_invitation`, `claim_group_invitation`, `get_invitation_preview`.
- Concept: allow group owners (via `is_group_owner`, post-S3E) to manage invitations, and change the RPC bodies to attach newly created people via the group rather than `groups.owner_user_id`.
- Expected behaviour: existing links keep working; co-owners gain invite rights.
- Risks: invitation flow is the main onboarding path; idempotency must be preserved.
- Rollback: restore prior function bodies and drop the added policy.

Only after all of S3B–S3F pass does S4 (relaxing the FKs / making creator IDs nullable) become discussable — and even then only for shared data, never for personal `group_id IS NULL` rows.

## 12. Regression tests per sub-stage

Applies to every stage: record counts for all 10 tables and the two known balance snapshots (440675a4 → +188765/−188765; b29d9051 → −174632/−164785/+339417) before and after, and require them bit-identical.

- S3B: create, edit and delete a receipt-split expense with items in a group as owner and as a non-owner participant; confirm item-level privacy (a private item stays invisible to others); confirm no recursion error on `item_splits`.
- S3C: add, edit, delete a manual group expense; record a full and a partial settlement; confirm activity feed and expense history render.
- S3D: rename a placeholder as owner; rename self as a claimed member; confirm a member cannot rename an unrelated person.
- S3E: full sweep — home, groups, group detail, activity, expense detail, settle-up, group settings, add/remove member; confirm a non-participant still gets zero rows on every table.
- S3F: create invitation, share, preview, claim as a new account, re-claim (idempotent), claim a revoked and an expired code.

No changes were made. S4 was not started.
