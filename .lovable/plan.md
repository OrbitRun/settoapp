# PARI — Security cleanup + S3D-3B transfer ownership

## Stage 1: Security cleanup (narrow)

### 1.1 Add missing receipts UPDATE policy
- Add `own receipt update` policy on `storage.objects` scoped to `bucket_id = 'receipts'` and `auth.uid()::text = (storage.foldername(name))[1]`.
- Match existing SELECT/INSERT/DELETE semantics exactly; do not broaden access.

### 1.2 Document intentional SECDEF warnings
- Update @security-memory to record:
  - `claim_group_invitation`, `get_invitation_preview`, `is_group_owner` are intentionally callable by `anon` because unauthenticated users must preview/claim group invitations.
  - `accept_group_invitation`, `can_read_expense_item`, `claim_group_invitation`, `create_group`, `get_invitation_preview`, `group_owner_fields_unchanged`, `is_group_owner`, `is_group_participant`, `redeem_group_invitation`, `update_my_people_name` are intentionally callable by `authenticated` because they are the app's authenticated RPC surface.
  - No grants will be changed without an explicit vulnerability audit.

### 1.3 Verify green
- Run `supabase linter` and confirm the `MISSING_STORAGE_UPDATE_POLICY` warning is gone.
- Run regression query: counts and balances bit-identical to baseline.

## Stage 2: S3D-3B — transfer_group_ownership

### 2.1 Audit current callers and surfaces
- Find all frontend and backend code that currently changes group ownership or depends on `owner_user_id`/`owner_person_id`.
- Map the UX flow for "transfer ownership" (e.g., group settings).

### 2.2 Design RPC
- `public.transfer_group_ownership(_group_id uuid, _new_owner_person_id uuid)` SECURITY DEFINER, `search_path = public`.
- Rules:
  - Caller must be current owner (`is_group_owner`).
  - New owner must be an active, linked, non-removed member of the group.
  - Update `groups.owner_user_id` and `groups.owner_person_id` atomically.
  - Update `group_members.role` for old and new owner (old becomes `member`, new becomes `owner`).
  - Log activity `ownership_transferred`.
  - Guard against seizure via `group_owner_fields_unchanged` policy.

### 2.3 Implement
- Add migration for RPC + ACL (`authenticated` + `service_role` only; no `anon`, no `PUBLIC`).
- Add frontend cutover only if the existing group-settings UI already has an ownership-transfer path.

### 2.4 Verify
- Transfer ownership between two real accounts.
- Confirm old owner becomes member, new owner becomes owner.
- Confirm non-owner seizure attempts blocked.
- Confirm counts and balances bit-identical.

## Out of scope
- S3D-4, S3E, S3F, S4 are not started.
- No broad changes to receipts access or existing SECDEF grants.
- No changes to `is_group_owner`, `is_group_participant`, `can_read_expense_item`, `create_group`, or `update_my_people_name` without an explicit audit.
