# Re-invite former members + delete account means a fresh start

Two identity-sensitive changes, planned after auditing the live database and the current code.

## What the audit found

**Re-invite:** A person invitation already exists and already claims an exact person row. Two things block the former-member case:

- The person sheet hides the invite button whenever the person is a former member.
- The claim function links the person to the new account but never clears the "removed" mark on the existing membership, so the person would stay listed as a former member after accepting.

**Delete account:** The current flow does the right thing for shared history — the person row survives for the others and is detached from the account — but two gaps remain:

- A group where nobody else has a real account is left behind as an ownerless group with all its expenses instead of being deleted.
- On the device, only the sign-in session, the query cache and the pending invitation are cleared; the local guest workspace, the current split draft and user-specific preferences stay behind.

Confirmed in the database: private receipt images' rows disappear together with the account, so their file paths must be read (as they already are) before the account is removed. Group content (expenses, items, splits, settlements, activity, invitations) is fully chained to the group, so deleting an abandoned group removes its dependents cleanly.

No place in the app links an account to old data by email or by name — that stays true.

## Part 1 — Invite a former member back

Tapping a former member opens the same detail sheet as today, showing "Tidligere medlem" and their historical balance, with one primary action:

- Danish: "Invitér igen" / English: "Invite again"

It opens the existing invitation sheet for that exact person — same link, QR and code as any other person invitation. Opening or sharing it changes nothing; the person stays a former member.

When the recipient accepts:

- the same historical person is linked to their account
- the existing membership becomes active again
- every old expense, split, settlement and the balance stay exactly where they are
- no second person and no second membership are created

Accepting twice is harmless. A person already linked to someone else cannot be claimed, and an active person's invitation behaves exactly as today.

## Part 2 — Delete account = fresh start

Keeps the name "Slet konto" / "Delete account" and the typed confirmation. Only the wording gets clearer:

> Din konto og alle dine private Setto-data slettes permanent. Hvis du opretter dig igen — også med samme mail — starter du helt forfra. Fælles historik kan blive bevaret for andre deltagere.

Behaviour per situation:

| Situation | Result |
| --- | --- |
| Your private expenses, receipts, drafts | Deleted permanently |
| Group you own, someone else has a real account | Ownership moves to the longest-standing active member with an account; group keeps working |
| Group you own, nobody else has an account | Group and everything in it is deleted |
| Group owned by someone else | Group untouched; you become a former member, your history stays for the others, detached from your account |

Receipt images are removed before the account is; if any image cannot be removed, the deletion stops and can be retried safely rather than leaving private pictures behind.

Afterwards the device is wiped of Setto data: session (including the secure store on iPhone), cached account data, pending invitation, local guest workspace, current split, receipt draft and user-specific preferences — then back to the signed-out start screen. Force-closing and reopening stays signed out.

Signing up again with the same email produces a brand new, empty Setto. The only way to get old shared history back is being explicitly invited to that old person.

## Technical notes

- Migration 1 — harden `claim_group_invitation`: for a person invitation, in the same transaction as the person link, `UPDATE` the existing `group_members` row for (invitation group, invitation person) back to active (`removed_at = null`), preserving role and default split fields. If no membership row exists for that pair, return an invalid result — a person invitation never inserts a replacement membership. Returns `claimed` + group id as today. Group-wide invitations unchanged.
- Migration 2 — extend `delete_my_account()`: keep the existing successor rule (oldest active linked member by `joined_at`, then person id) and all current owner-field neutralisation; add Case C — when no active linked successor exists, `DELETE FROM public.groups` for that group (expenses, items, splits, settlements, activity and invitations follow by cascade) instead of orphaning it, then continue with the existing person unlink and placeholder cleanup and the existing final "no owner references remain" assertions. Still `auth.uid()`-only, idempotent.
- Receipt storage order in `src/lib/account.functions.ts` is reordered, since the cleanup function now deletes groups: authenticate → read this user's receipt `storage_path` values first → run the cleanup function → require `ready_for_auth_delete` → delete the captured Storage objects → verify none remain → delete the auth user → only then clear local device state. A failure at any stage stops before the auth user is deleted and stays safely retryable; no signed URLs, tokens or secrets are logged.

- `src/components/pari/PersonSheet.tsx`: invite eligibility becomes `!person.linked && !person.isSelf`; label resolves to `invite.person.inviteAgain` for former members. `src/routes/groups.$groupId.tsx` already passes former people into the sheet.
- `src/lib/i18n.tsx`: new keys `invite.person.inviteAgain` and revised `profile.deleteAccount*` copy, Danish and English.
- New `src/lib/account-cleanup.ts` with a pure `settoLocalKeys()`/`clearSettoLocalState()` used by the profile delete flow: guest state key, pending invite, split draft, receipt draft, privacy/user preferences, Supabase session keys, plus `clearNativeSecureSession()` and `queryClient.clear()`.
- Tests first, expected to fail for the stated reasons: person-sheet eligibility and label for a former person; claim reactivation semantics (same person id, membership active, no duplicates, idempotent, already-linked rejected); local-state key coverage; fresh-start invariant (no email/name based relinking anywhere).
- Validation: focused tests, existing invitation and native-auth tests, full suite, typecheck, web production build, `SETTO_NATIVE=1` build, `cap sync ios`.

Migrations are additive function replacements plus a new delete branch; no column or table is dropped or renamed, so they apply safely to the live database.
