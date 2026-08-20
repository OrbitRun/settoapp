# Stage S3C — People and personal-data ownership readiness (audit report + proposed minimal migration)

Read-only audit complete. Nothing was changed. S3D/S3E/S3F/S4 not started.

## 1. Current people ownership model

`people.owner_user_id` today means all three at once: creator, owner, and tenant/security boundary. The only write path is the permissive `own people` policy (`FOR ALL`, `auth.uid() = owner_user_id`). Reads have a second permissive path: `participants can read group people` (person is in a group the caller participates in). FK is `owner_user_id -> auth.users ON DELETE CASCADE`, and `linked_profile_id -> profiles ON DELETE SET NULL`.

Live rows (10 total, all `status = 'active'`):

| Class | Count | Examples |
|---|---|---|
| 1. Claimed self linked to profile | 4 | Jonas, Zia, t178…, each `is_self`, `linked_profile_id` set |
| 2. Claimed group person (linked, not self) | 0 | — none yet; the invite claim path produces them |
| 3. Unclaimed placeholder | 6 | Zia, Scott, Kasper (in groups, carry splits/payments), Person 2/3/4 (orphan placeholders, 0 memberships, 0 splits) |
| 4. Former person | 0 | `status`/`unlinked_at` exist from S1 but unused |

All 6 placeholders are owned by one user (`c2415b89`). Four financially-active people (Jonas self, Zia, Scott, Kasper) carry 15/3/1/1 payments and 20/12/8/8 splits — these are the rows that must survive account deletion.

**What breaks if `people.owner_user_id` went NULL:** every write on people (rename, avatar, claim-related updates) fails — `own people` is the only write path. Group participants would still read group people, but placeholders with no membership (Person 2/3/4, and every self row, which has 0 memberships) would become invisible and unwritable to everyone. RED.

## 2. Current personal-expense ownership model

`expenses.group_id IS NULL` = personal. Current data: **0 personal expenses, 0 personal items/splits/item_splits.** So there is no legacy personal data to protect — only future rows.

Path analysis for personal rows:

| Table | SELECT | INSERT | UPDATE | DELETE | owner_user_id reliance |
|---|---|---|---|---|---|
| expenses (group_id NULL) | `own expenses` only (the participant SELECT requires `group_id IS NOT NULL`) | `own expenses` + restrictive `group_id IS NULL OR participant` | same | `own expenses` | total — RED |
| expense_items (personal parent) | `own expense items` only (participant SELECT requires group parent) | `own …` + restrictive parent-authority (S3B-FIX) | same | same | total — RED |
| expense_splits (personal parent) | same shape | same | same | same | total — RED |
| item_splits (personal parent) | `own item splits`; `can_read_expense_item` only covers group parents | `own …` + restrictive parent-authority | same | same | total — RED |
| activity (group_id NULL, 16 rows) | `own activity` only | `own …` + restrictive `group_id IS NULL OR participant` | same | same | total — RED |
| settlements | always group-scoped (`group_id NOT NULL`) | — | — | — | YELLOW (group path exists) |

`person_id` / `linked_profile_id` play no role in any personal-data authorization path today.

## 3. Remaining owner_user_id dependencies in personal/non-group data

1. `expenses` personal rows: sole SELECT/INSERT/UPDATE/DELETE key.
2. `expense_items`, `expense_splits`, `item_splits` under a personal parent: sole key (the S3B group policies deliberately require `group_id IS NOT NULL`).
3. `activity` with `group_id IS NULL`: sole key.
4. `people`: sole write key for all classes, sole read key for non-group people.
5. `group_invitations`: owner-only, unchanged by this stage.

## 4. Recommended durable identity model for people (option C, smallest)

Keep `people` as the durable historical identity, and split its two meanings without renaming anything now:

- `owner_user_id` stays NOT NULL for now and keeps meaning **creator / personal-address-book tenant**.
- Durable group visibility already comes from `group_members` + `is_group_participant`, which does not touch `owner_user_id`. That is the survival path.
- Future account deletion must **not** cascade people. Required change before S4: replace `people_owner_user_id_fkey ON DELETE CASCADE` with `ON DELETE SET NULL` (paired with allowing NULL) — proposed for S3D, not now.
- Claimability rule to encode later: claimable iff `linked_profile_id IS NULL AND status = 'active'`. `former` people are readable via group membership but never claimable.
- Self-identity management: an active user should manage their own person row via `linked_profile_id = auth.uid()`, not via `owner_user_id`. This is the one write path that must be added before `owner_user_id` can ever be NULL.

## 5. Recommended private ownership model for personal expenses — option A

Keep `owner_user_id` NOT NULL permanently for personal rows, and make that explicit in the schema rather than implicit:

```
CHECK (group_id IS NOT NULL OR owner_user_id IS NOT NULL)
```

on `expenses`, with child rows deriving privacy from the parent (already enforced by the S3B-FIX restrictive parent-authority policies). Option B (a second durable private ownership relation) adds a table and a second security boundary for data that is defined by being non-durable — rejected. Personal data is private, must die with the account, and `owner_user_id` + `ON DELETE CASCADE` is exactly the right primitive for it.

## 6. Personal expenses on future account deletion

Deleted, deterministically, via the existing `ON DELETE CASCADE` on `expenses.owner_user_id`, which already cascades items/splits/item_splits through parent FKs. Personal `activity` rows likewise. Receipts (future private storage objects) deleted alongside. No change needed — the deterministic marker is `group_id IS NULL`.

## 7. Shared group history on future account deletion

Survives through `groups` + `group_members` + `people`. Required before S4 (S3D/S3E scope):
- shared rows must stop cascading on `owner_user_id`: `expenses` (group-scoped), `expense_items`, `expense_splits`, `item_splits`, `settlements`, `activity` (group-scoped), `group_members`, `groups`, `people` move to nullable creator + `ON DELETE SET NULL`.
- write policies must have a working group-anchored permissive path that does not require `e.owner_user_id = auth.uid()` — today's S3B policies still require it, so they are a read-only-safe half-step.

## 8. Exact schema/RLS changes required before S4

1. Rename semantics (not the column) of `owner_user_id` to "creator_user_id" in documentation; optional physical rename deferred.
2. `people`: add a self-management write path keyed on `linked_profile_id = auth.uid()`.
3. `people`: FK to `ON DELETE SET NULL` + nullable (S3D).
4. Group-scoped tables: permissive write policies keyed on participation alone, without `owner_user_id` equality (S3E).
5. Personal tables: keep the `owner_user_id` key and add the group/owner CHECK invariant.
6. Deletion routine that deletes personal rows and nulls creator on shared rows (S4).

## 9. Tables that KEEP owner_user_id NOT NULL

`profiles` (its `id` is the user), and every row where `group_id IS NULL`: personal `expenses`, their `expense_items` / `expense_splits` / `item_splits`, personal `activity`. Enforced by conditional CHECK, not by a blanket NOT NULL.

## 10. Tables that may eventually allow NULL creator_user_id

`people`, `groups`, `group_members`, `settlements`, group-scoped `expenses`, `expense_items`, `expense_splits`, `item_splits`, group-scoped `activity`, `group_invitations`.

## 11. Proposed smallest S3C implementation migration (not applied)

Two additive, behaviour-preserving pieces:

```sql
-- (a) Self-identity write path: a user may always read/update their own linked person row.
CREATE POLICY "self person read" ON public.people
  FOR SELECT TO authenticated
  USING (linked_profile_id = auth.uid());

CREATE POLICY "self person update" ON public.people
  FOR UPDATE TO authenticated
  USING (linked_profile_id = auth.uid())
  WITH CHECK (linked_profile_id = auth.uid());

-- (b) Make the personal/private invariant explicit and enforced.
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_personal_requires_owner
  CHECK (group_id IS NOT NULL OR owner_user_id IS NOT NULL) NOT VALID;
ALTER TABLE public.expenses VALIDATE CONSTRAINT expenses_personal_requires_owner;
```

Nothing dropped, no function, grant, FK, nullability, `owner_person_id`, `people.status`, `unlinked_at`, `linked_profile_id` value, invitation, auth, storage, FX or UI change. Both additions are strictly permissive-or-invariant and cannot reduce current access.

Marks after this migration: `people` YELLOW (write still needs `owner_user_id` for non-self placeholders), personal `expenses`/children/`activity` RED by design (intentional, private), `groups`/`group_members`/`settlements` YELLOW, `profiles` GREEN.

## 12. Regression tests

- Before/after row counts for all 12 tables (baseline: people 10, expenses 20, expense_items 105, expense_splits 48, item_splits 0, activity 69, group_members 5, groups 2, settlements 1).
- Before/after balance snapshot per group (440675a4 +88765/-88765; b29d9051 +339417/-174632/-164785) must be bit-identical.
- Jonas: rename own self person still works; rename placeholder Zia/Scott/Kasper still works.
- Zia: can read Jonas-owned group people via membership; can now read/update her own linked self row; still cannot update Jonas's placeholders.
- Outsider: still blocked on all people writes.
- Insert a group expense (owner path) and a personal expense; verify the new CHECK does not block either.
- Confirm no `item_splits` recursion.
- Linter count unchanged (10 pre-existing SECURITY DEFINER notices).

## 13. Rollback strategy

Single reverse migration: `DROP POLICY "self person read"`, `DROP POLICY "self person update"`, `ALTER TABLE public.expenses DROP CONSTRAINT expenses_personal_requires_owner`. No data is written or moved, so rollback is instantaneous and lossless.

## Table status summary

| Table | Mark | Reason |
|---|---|---|
| profiles | GREEN | keyed on `id = auth.uid()`, no creator column |
| settlements | YELLOW | participant read/write guards exist; permissive write still owner-keyed |
| expenses (group) | YELLOW | participant SELECT exists; write still owner-keyed |
| activity (group) | YELLOW | same |
| expense_items / expense_splits / item_splits (group) | YELLOW | S3B participant policies still require `e.owner_user_id = auth.uid()` |
| groups | YELLOW | participant SELECT + `owner_person_id` backfilled; write owner-keyed |
| group_members | YELLOW | `is_group_owner` guards; permissive write owner-keyed |
| people | RED | sole write key; sole read key for non-group people |
| expenses + children + activity where `group_id IS NULL` | RED by design | private data, must stay owner-keyed |
| group_invitations | RED | owner-only, out of S3C scope |
