# Safe auth + invitation + email pass

Scope: authentication lifecycle, password reset, invitation robustness, and email code structure. No changes to financial logic, group queries, membership semantics, or existing access rules.

## Pre-flight snapshot (recorded, read-only)

Current backend state, captured before any change:

- 3 accounts, 3 profiles, 9 people
- 2 groups: "Zia & Jonas" (2 members) and "Sheltertur 2026" (3 members), both owned by the same account
- 5 group_members rows, 21 expenses, 51 splits, 1 settlement, 68 activity entries, 2 invitations
- Identity mapping in use today: `auth.uid()` = `profiles.id`; membership is `group_members.person_id` -> `people.id`, where `people.linked_profile_id` = `auth.uid()`. There is no `group_members.user_id`/`profile_id`. This mapping stays exactly as is.
- Access rules use the helper `is_group_participant(group_id, user_id)`, which treats an existing `group_members` row (or group ownership) as full proof of membership. No invitation is involved. This stays untouched.

These numbers are the comparison baseline for the final check.

## What actually needs fixing

1. **No password reset exists.** There is no "forgot password" entry point and no route to set a new password after clicking the emailed link.
2. **Invitation acceptance uses the weaker path.** The app calls a function that throws on any problem, so expired, revoked, invalid and already-a-member all surface as one generic failure. A safer function already exists in the backend (`redeem_group_invitation`) that returns a distinct status and never creates a duplicate membership. Switching to it is a code-only change.
3. **Invite context after signup is fragile.** The pending invite is stored in the browser, but a new user who must confirm their email can land back without it being applied cleanly, and there is no visible "returning to your invitation" state.
4. **Auth error messages are raw backend strings** shown directly in toasts.
5. **Email content is not separated from auth logic**, so branding can't be added later without touching auth.

## Plan

### Password reset (new, additive)

- Add a "Forgot password?" link on the sign-in screen that opens a small email prompt and sends the reset mail via the existing auth provider (no custom tokens), with the redirect pointing at a new `/reset-password` route.
- New public route `/reset-password`: detects the recovery session from the link, shows two password fields, updates the password, then signs the user into `/home`.
- Handle the link states explicitly: valid, expired, already used, invalid — each with a plain localized message and a way to request a new link.
- Nothing in the reset path touches profiles, people, group_members or any financial table.

### Invitation hardening (code only)

- Switch invite acceptance to the existing idempotent backend function that returns one of: `joined`, `already_member`, `revoked`, `expired`, `invalid`, `unauthenticated`. Map each to a localized message on the invite screen.
- `already_member` opens the group directly — no insert, no activity, no duplicate.
- Guard repeated taps (in-flight lock plus disabled button) so double-tap cannot double-call.
- Logged-out flow: store the token, carry it through sign-in/sign-up, and after the session exists return to the same invitation and accept it, then open the group. Show a short "completing your invitation" state instead of a silent redirect.
- New user flow: membership is only created after authentication completes; the stored token survives an email-confirmation round trip.
- Keep the URL shape `/invite/{token}` (and the legacy `/join/{token}` redirect) unchanged so Universal Links / App Links can be attached later.
- No membership rows, ownership, expenses, balances or activity are altered for existing members.

### Auth lifecycle audit

Walk through and fix only what is broken, without redesigning screens: sign up, email verification, login, logout, session restore, route protection for authenticated screens, and the four bad-link states. Replace raw backend error text with localized, non-technical messages (Danish + English).

### Email infrastructure (code structure only)

No sender domain is configured, so default auth emails keep working as they do today. This pass only separates concerns so branding can be dropped in later without touching auth:

- Keep auth logic free of any email copy.
- Put user-visible email wording (verification, password reset, invitation, email-change) into one localized content module, with neutral unbranded copy.
- Invitation wording may include the inviter's name and the group name only — never balances, expenses, receipts, settlements or other members' amounts.
- Actual sending domain, templates and styling are deliberately deferred to a later pass.

### Database

Expected: **no migration**. The invitation table, the idempotent redeem function, and all access rules needed already exist. If something turns out to be missing, it will be additive-only, scoped to the invitation table alone, with existing rules for groups, members, expenses, splits, settlements, profiles and activity left untouched — and I'll flag it before applying.

### Regression guard

After any backend change (if one becomes necessary) and again at the end, I re-run the snapshot query and confirm: 2 groups, 5 memberships, 21 expenses, 51 splits, 1 settlement, 68 activity rows, and the same group IDs and owner. Any unexpected difference stops the work and the last change is reverted.

## Technical notes

- Files touched: `src/routes/auth.tsx`, new `src/routes/reset-password.tsx`, `src/routes/invite.$token.tsx`, `src/data/invitations.ts`, the pending-invite effect in `src/data/store.tsx`, `src/lib/i18n.tsx`, and a new email-copy module.
- `acceptInvitation` is repointed from `accept_group_invitation` to `redeem_group_invitation` (already present in the database, security definer, checks existing membership first).
- Not touched: `is_group_participant`, all policies on groups/group_members/expenses/expense_splits/settlements/activity/people/profiles, and all split/FX/settlement code.
- Receipt image privacy is explicitly out of scope.

## Testing

- Password reset: request -> link -> new password -> login, then confirm same profile, same groups, same balances, same activity.
- Invitation A: signed-in user, new test invite to a group they are not in -> joins once.
- Invitation B: signed out -> invite -> login -> back to same invite -> joins.
- Invitation C: new account -> invite -> signup -> back to same invite -> exactly one membership.
- Invitation D: accept twice -> no duplicate membership, no duplicate activity.
- Only newly created test invitations are used; no existing membership is modified to test anything.
