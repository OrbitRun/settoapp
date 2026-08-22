# PARI — Security cleanup + S3D-3B transfer ownership

## Stage 1: Security cleanup (narrow)

### 1.1 Receipts UPDATE policy
- Add only the missing `storage.objects` UPDATE policy for bucket `receipts`.
- Match the existing owner-folder semantics exactly: `bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]`, role `authenticated`, in both `USING` and `WITH CHECK`.
- Do not broaden receipt access; leave SELECT/INSERT/DELETE untouched.
- Run linter and the regression baseline (counts, ownership mappings, split-sum 1,892,653 øre) after this change.

### 1.2 SECURITY DEFINER anon audit (read-only, no ACL changes)
Do not document the anon grants as intentional yet. Audit these three separately:

- `get_invitation_preview`
- `claim_group_invitation`
- `is_group_owner`

For each, report:
- exact ACL
- direct frontend/backend call sites
- whether an unauthenticated client directly invokes it
- whether other SECURITY DEFINER functions call it internally
- what would actually break if `anon` EXECUTE were removed

Expected direction only (to be proven, not assumed):
- `get_invitation_preview` is likely intentionally anon
- `claim_group_invitation` may or may not require anon — prove it
- `is_group_owner` must NOT be classified as intentionally public merely because invitation flows exist

No ACL is changed during this audit. Only after an unauthenticated call requirement is demonstrated for a given function is its anon warning documented as intentional in @security-memory. The authenticated-only SECDEF warnings are documented as the app's intended authenticated RPC surface.

## Stage 2: S3D-3B — transfer_group_ownership

Implement only after Stage 1 is GREEN. If the receipt policy change or the SECDEF audit reveals anything unexpected, STOP before creating `transfer_group_ownership`.

### 2.1 RPC definition
`public.transfer_group_ownership(_group_id uuid, _new_owner_person_id uuid)`, SECURITY DEFINER, `search_path = public`, fully schema-qualified, no dynamic SQL, identity only from `auth.uid()`.

Authorization, before any write:
- `SELECT` the target group `FOR UPDATE`
- reject unauthenticated callers
- require BOTH `locked_group.owner_user_id = auth.uid()` AND `public.is_group_owner(_group_id, auth.uid()) = TRUE` (preserves transitional authority until S3D-4)

Validate current durable owner state after locking the group. Require:
- `locked_group.owner_person_id IS NOT NULL`
- current owner person exists
- `status = 'active'`
- `unlinked_at IS NULL`
- `linked_profile_id = auth.uid()`
- current owner person has a `group_members` row in this group with `removed_at IS NULL`

Reason: `is_group_owner` still contains a legacy OR branch based on `owner_user_id`, so `owner_user_id = auth.uid()` plus `is_group_owner()` does not by itself prove the durable `owner_person_id` path is healthy. If durable ownership is inconsistent, raise an explicit transitional-data error — do NOT silently repair it inside the RPC.

Successor must:
- exist
- `status = 'active'`
- `unlinked_at IS NULL`
- `linked_profile_id IS NOT NULL`
- already have a `group_members` row in the group with `removed_at IS NULL`

Lock successor eligibility rows: after locking the `groups` row, lock/read the successor person row and the successor `group_members` row before changing ownership, so the successor cannot be removed or unlinked between validation and transfer. Consistent lock order: group → people row(s) → group_members row(s).

If the successor is already owner: return success as a no-op, log no duplicate activity.

### 2.2 Atomic effects
Before updating `groups`, store the caller `auth.uid()` and the previous `owner_person_id` in local variables so the activity actor is not derived from the already-updated group row.

- `groups.owner_person_id` = successor person
- `groups.owner_user_id` = successor `linked_profile_id`
- `groups.orphaned_at = NULL`
- successor `group_members.role = 'owner'` — the UPDATE still requires `removed_at IS NULL` and verifies exactly one row was affected
- previous owner `group_members.role = 'member'`
- exactly one `ownership_transferred` activity row

Activity insert: inspect the existing activity schema and conventions first. The actor must represent the person who performed the transfer (the previous owner/caller), not the new owner. Match existing required fields exactly; invent no new owner/actor semantics.

Note: `group_owner_fields_unchanged` does NOT protect writes performed inside this RPC, because SECURITY DEFINER bypasses RLS. The RPC's own authorization and successor checks are the seizure protection.


### 2.3 ACL
- no PUBLIC
- no anon
- `authenticated` EXECUTE
- `service_role` only if consistent with the current convention

### 2.4 Frontend
No transfer UI is added unless such a UI already exists.

### 2.5 Testing
- Prefer a temporary test group between linked test identities.
- Do not leave a real production group transferred.
- Verify: valid transfer, no-op when successor already owner, rejection for non-owner, unauthenticated, removed member, unlinked person, and non-member successor.
- Return ownership and clean all temporary test activity/data so counts, ownership mappings and balances return to baseline.

## Out of scope
- S3D-4, S3E, S3F, S4 are not started.
- No broad changes to receipts access.
- No grant changes on existing SECDEF functions without a confirmed vulnerability.
- No changes to `is_group_owner`, `is_group_participant`, `can_read_expense_item`, `create_group`, or `update_my_people_name` without an explicit audit.
