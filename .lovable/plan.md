# Account Deletion & Shared History — Design Audit

Read-only analysis. Nothing implemented, no migration run.

## 1. Current cascade dependency map

Verified against the live database (28 FKs). `c` = ON DELETE CASCADE, `n` = SET NULL.

| Table | Column | References | Delete rule |
|---|---|---|---|
| profiles | id | auth.users | CASCADE |
| people | owner_user_id | auth.users | CASCADE |
| people | linked_profile_id | profiles | SET NULL |
| groups | owner_user_id | auth.users | CASCADE |
| group_members | owner_user_id | auth.users | CASCADE |
| group_members | group_id / person_id | groups / people | CASCADE |
| expenses | owner_user_id | auth.users | CASCADE |
| expenses | group_id / paid_by_person_id | groups / people | CASCADE |
| expense_items | owner_user_id | auth.users | CASCADE |
| expense_items | expense_id | expenses | CASCADE |
| expense_splits | owner_user_id | auth.users | CASCADE |
| expense_splits | expense_id / person_id | expenses / people | CASCADE |
| item_splits | owner_user_id | auth.users | CASCADE |
| item_splits | expense_item_id / person_id | expense_items / people | CASCADE |
| settlements | owner_user_id | auth.users | CASCADE |
| settlements | group_id / from_person_id / to_person_id | groups / people | CASCADE |
| activity | owner_user_id | auth.users | CASCADE |
| activity | group_id | groups | CASCADE |
| activity | actor_person_id | people | SET NULL |
| group_invitations | owner_user_id | auth.users | CASCADE |
| group_invitations | group_id / person_id | groups / people | CASCADE |

Chain effect: deleting one auth user removes their `people` rows → cascades to every `group_members`, `expenses` (as payer), `expense_splits`, `item_splits`, `settlements` referencing those people; and removes their `groups` → cascades to all expenses/items/splits/settlements/activity/invitations in that group, regardless of who else participates.

## 2. Why the current model is dangerous

- `owner_user_id` is used simultaneously as authorization owner, creator/audit field, and hard FK to a deletable identity. All group-scoped rows created by a user vanish with them, even inside a group they do not own.
- Group owner deletion destroys the whole group for everyone else.
- Balances silently change: removing splits/settlements rewrites arithmetic for remaining members with no audit trail.
- No distinction between "personal data" (deletable) and "shared transactional record" (jointly relevant).

## 3. Recommended durable identity model

Adopt the layering the request sketches:

```text
auth.users   (temporary login identity, deletable)
   |
profiles     (personal data, deletable/anonymisable)
   |
people       (DURABLE historical identity — never deleted while referenced)
   |
expenses / expense_splits / item_splits / settlements / activity
```

`people` already fits: financial rows reference `person_id`, and `linked_profile_id` is already SET NULL. Deleting an account becomes: unlink `people.linked_profile_id`, mark the person as a former member, keep every financial row byte-identical.

Distinguishing former members from ordinary placeholders (must not be claimable):

CURRENT: `people(linked_profile_id null|uuid, is_self)` — null means "invitable placeholder".
PROPOSED: add `people.status text` (`active` | `former`) plus `people.unlinked_at timestamptz`, and `display_name_override` (e.g. "Tidligere medlem"). `claim_group_invitation` / `redeem_group_invitation` refuse persons with `status = 'former'`, and invitation creation is blocked for them. Optionally keep an opaque `former_profile_hash` for dedupe, never the email.

## 4. Recommended group ownership model

Ownership becomes a relationship, not a hard FK to auth.

CURRENT: `groups.owner_user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE`.
PROPOSED: `groups.owner_person_id uuid REFERENCES people` as the authoritative admin pointer, with `groups.owner_user_id` retained but nullable and `ON DELETE SET NULL` during the transition; `group_members.role in ('owner','admin','member')` becomes the source of truth for administration.

Deterministic ownership transfer order on owner deletion:
1. Existing `role = 'admin'` member with a claimed (`linked_profile_id NOT NULL`, `status='active'`, `removed_at IS NULL`) person, earliest `joined_at`.
2. Otherwise the earliest-joined claimed active member.
3. Tie-break by `person_id` (UUID ordering) for determinism.
4. If none qualifies → Case C/D handling, never an unclaimed placeholder.

## 5. Normal-member deletion flow (Case A)

1. Verify caller identity; disallow if they are the sole owner of a group with other claimed members until transfer (step in Case B) completes.
2. Delete `profiles` row (or blank display_name/avatar/preferences).
3. For each `people` row with `linked_profile_id = user`: set `linked_profile_id = NULL`, `status = 'former'`, `unlinked_at = now()`, name → localized "Tidligere medlem" (retain original name only if product decides history readability outweighs erasure; default: anonymise).
4. Set `group_members.removed_at = now()` for their memberships so they lose participant access, but keep the row for history.
5. Re-point any `owner_user_id` on rows they created to NULL (creator field) — never delete the rows.
6. Revoke sessions and delete the auth user last.

Splits, settlements, and balances are untouched; the person node they hang off survives.

## 6. Group-owner deletion flow (Case B)

Same as Case A, preceded by: for every group they own with ≥1 other claimed active member, run the deterministic transfer from §4 (set `groups.owner_person_id`/`owner_user_id` to the successor, set their `group_members.role='owner'`, write an `activity` event `ownership_transferred`). Offer the user an explicit successor choice in the UI; the deterministic rule is the fallback.

## 7. Case C (owner is the only claimed user) and Case D (last real user)

Case C: no eligible human successor. Do not promote a placeholder. Archive the group: `groups.archived_at = now()` plus a new `groups.orphaned_at`, ownership left NULL, no participant can read it (nobody qualifies), invitations revoked. Retain for the retention window, then purge.

Case D tradeoffs:
- Immediate delete: cleanest GDPR story, irreversible, breaks any pending invite/recovery.
- Soft-delete/archive + retention (recommended, 30 days): matches Lovable's own 30-day account-deletion grace, allows accidental-deletion recovery, keeps no personal data because §5 already anonymised it.
- Indefinite retention: fails data minimisation once no data subject benefits.

Recommendation: anonymise immediately, archive the orphaned group, hard-purge orphaned groups (and their expenses/splits/settlements/activity/receipts) by scheduled job after 30 days.

## 8. Future private-receipt deletion flow (Case E)

Keep receipts a separate, user-private table (`receipts` + storage object) with `expenses.receipt_id uuid NULL REFERENCES receipts ON DELETE SET NULL`. Never the reverse direction. On account deletion: delete receipt rows, storage objects, and warranty/return metadata owned by the user; the shared expense keeps its items, splits, settlements, and merely loses the image pointer (`receipt_id = NULL`, optional `receipt_removed_at` for UI copy "Kvittering ikke længere tilgængelig").

## 9. GDPR / retention model

- **Delete:** auth user, profiles row, private receipts + images + warranty metadata, device/session data, invitation email targets.
- **Anonymise:** `people` name/avatar for former members, `activity.metadata` fields carrying personal names, creator references (`owner_user_id` → NULL).
- **Retain:** expenses, expense_items, expense_splits, item_splits, settlements, group_members history — jointly relevant transactional records of the *other* users; retention is for their legitimate interest in a correct shared ledger (purpose limitation: settlement accuracy only, no marketing/profiling reuse).
- Purge retained shared rows when no data subject requires them (Case D job).
- Not legal advice; wording of the deletion notice and any statutory retention should be reviewed by counsel.

## 10. Required schema changes (CURRENT → PROPOSED)

| Item | CURRENT | PROPOSED |
|---|---|---|
| `profiles.id` FK | auth.users CASCADE | unchanged (profile is personal data; deletion intended) |
| `people.owner_user_id` | NOT NULL, auth.users CASCADE | nullable `creator_user_id`, ON DELETE SET NULL |
| `people` | no lifecycle state | + `status`, `unlinked_at`, keep `linked_profile_id` SET NULL |
| `groups.owner_user_id` | NOT NULL CASCADE | nullable, SET NULL; + `owner_person_id` → people; + `orphaned_at` |
| `group_members.owner_user_id` | NOT NULL CASCADE | nullable creator, SET NULL; role becomes authority |
| `expenses/expense_items/expense_splits/item_splits/settlements/activity .owner_user_id` | NOT NULL CASCADE | nullable creator, SET NULL (historical integrity does not need it) |
| `group_invitations.owner_user_id` | NOT NULL CASCADE | nullable, SET NULL; invitations of deleted owners auto-revoked |
| receipts (future) | n/a | private table, `expenses.receipt_id` SET NULL |

Per-table `owner_user_id` verdicts: `groups` = authorization (→ move to owner_person_id + role); `group_members` = creator/audit; `expenses`, `expense_items`, `expense_splits`, `item_splits`, `settlements`, `activity` = creator/audit only (authorization already flows through `is_group_participant(group_id)`); `people` = creator/tenant pointer (→ nullable creator); `group_invitations` = creator + authorization (→ owner_person_id/role check).

## 11. Required RLS changes

Today many tables carry both `own X` (`auth.uid() = owner_user_id`) and participant policies. Once `owner_user_id` is nullable, `own X` silently stops matching — which is fine *only if* participant policies fully cover reads and writes.

- Keep `is_group_participant()` and its grants untouched (it already resolves through `group_members` + `people.linked_profile_id`, i.e. independent of any creator's auth.uid()).
- Before nulling any `owner_user_id`, ensure every affected table has a participant-based SELECT policy and a membership-checked write policy (already true for expenses, settlements, activity, group_members, item_splits after the earlier fixes; `expense_splits`, `expense_items`, `people` need review for write paths).
- Replace `is_group_owner(group_id, auth.uid())` internals with a role/`owner_person_id` lookup rather than `groups.owner_user_id`, so admin rights survive transfer.
- Personal-scope tables with no group (`expenses.group_id IS NULL`, personal people) still need an owner path — keep `owner_user_id` NOT NULL semantics there or gate via `people.linked_profile_id`.
- Invitation claim RPCs must reject `status='former'` persons.

## 12. Required backend/function changes

- New `delete_account()` security-definer RPC (or server function using the admin client) performing §5/§6 in one transaction, plus auth user deletion.
- `transfer_group_ownership(group_id, successor_person_id)` with the deterministic fallback.
- Update `is_group_owner`, `handle_new_user`, `claim_group_invitation`, `redeem_group_invitation`, `get_invitation_preview` for the new ownership/person-status model.
- Scheduled purge job for orphaned groups past retention.

## 13. Required frontend/account-deletion UX

Profile → "Slet konto": explain what is deleted vs retained; list groups where the user is sole owner and require successor selection or explicit "archive group"; show the 30-day recovery window; final typed confirmation; post-deletion sign-out. Group screens render former members as "Tidligere medlem" (dimmed, no invite/resend actions), and expenses show "Kvittering ikke tilgængelig" where a receipt was removed.

## 14. Staged migration plan

Each stage is additive, independently deployable, and reversible.

1. **S1 — Person lifecycle:** add `people.status`, `unlinked_at` (defaults preserve today's behaviour). No behaviour change.
2. **S2 — Ownership relationship:** add `groups.owner_person_id`, `orphaned_at`; backfill `owner_person_id` from the owner's self-person; keep `owner_user_id` authoritative. Verify backfill covers 100% of groups.
3. **S3 — Policy readiness:** audit/extend participant policies so no table depends on `owner_user_id` for legitimate access; switch `is_group_owner` to role/owner_person_id. Verify visibility counts unchanged.
4. **S4 — FK relaxation:** drop/recreate each `*_owner_user_id_fkey` as nullable SET NULL, one table per migration, financial tables last.
5. **S5 — Deletion RPC + ownership transfer**, behind a feature flag, tested on a scratch account.
6. **S6 — Account-deletion UI**, then retention/purge job.
7. **S7 — Receipts** as a separate private table (only after S1–S6 are stable).

Checkpoints between every stage: row counts per table, per-group balance snapshot hash, visible-group count per test user. Rollback: S1/S2 are pure additions (drop column); S3 policies are additive (drop new policy); S4 is reversible by restoring the CASCADE FK as long as no NULLs were written yet — so S4 must ship before any deletion code (S5).

## 15. Regression tests

- Balance snapshot per group before/after every stage — must be identical.
- Member deletion: splits count, sum of splits, settlements, group balances unchanged; former person not invitable; deleted user gets 403 on group reads.
- Owner deletion with 1+ claimed members: group visible, successor can edit group, balances unchanged.
- Owner deletion with only placeholders: group archived, no placeholder promoted.
- Last-user deletion: archive then purge after retention; purge removes all group-scoped rows.
- Invitation claim on a former person → rejected; on an ordinary placeholder → still works.
- Receipt deletion leaves expense/items/splits intact.

## 16. Risks and open questions

- Nulling `owner_user_id` while an `own X` policy is the only write path would lock users out — S3 must prove coverage first.
- Personal (non-group) expenses have no participant policy; they need an explicit owner path before S4.
- `activity.metadata` may embed personal names — needs an anonymisation sweep, not just FK changes.
- Should a former member's real name be retained for other members' comprehension, or always replaced? Default proposal: replace.
- Retention window length (30 days proposed) and whether account deletion is reversible during it.
- Storage objects under `receipts` are not covered by table FKs; deletion must be explicit.

## Recommended implementation sequence

S1 → S2 → S3 → S4 (per table) → S5 → S6 → retention job → S7 (private receipt archive). Each is a small, independently testable migration with a balance-snapshot checkpoint.
