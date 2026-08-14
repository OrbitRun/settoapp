# PARI — Invitations, person identity, signup conversion

Three additions on top of the current app. No changes to the guest/auth model, scroll behaviour, amount input or navigation.

## 1. Group invitations

One invitation per share action, usable in four ways: native share link, QR code, copy link, and a short join code.

- A group detail screen gains an "Inviter" action that opens a sheet with: the link, a QR code of that link, copy button, native share button, and the 6-character join code shown large.
- Invitation link format `/join/<token>`; the join code resolves to the same invitation.
- The invitation page (public, works signed out) shows: group name, inviter's name, member count, and a "Deltag i gruppen" button.
- Signed in: joining links the user's own person to the group immediately and lands on the group.
- Not signed in: the button leads to signup/login; the pending invitation token is stored locally and applied right after authentication, then the user lands on the group. This reuses the existing post-login guest-migration step, so a pending split and a pending invite can both survive signup.
- Invitations can be revoked, expire after 14 days, and remain valid for multiple people (a shared link) unless revoked.

## 2. Person identity

Make people distinguishable everywhere, especially item splitting where names such as Mads, Mathias and Mikkel collide.

- Avatar priority: profile photo when the person is linked to a profile that has one, otherwise initials.
- Initials become smart: two characters derived from the name (first + last initial when there is a surname, otherwise the first two letters), and when two people in the same context still collide, extend to the first distinguishing letters.
- The full first name is shown next to the avatar wherever space allows: participant chips, item-split assignment rows, result rows, balances and settlement rows.
- In item splitting, each assignable person renders as a chip with avatar + first name rather than a bare initial circle; the compact avatar-only stack is kept only for dense read-only summaries, where each avatar also carries a distinct colour derived from the full name.
- Profile photo upload for the signed-in user is added on the profile screen (stored in the existing receipts-style private bucket pattern, new `avatars` bucket, public read).

## 3. Signup conversion after a guest split

On the guest result screen, "Del resultat" stays the primary action. Below it, a non-blocking value card appears:

- Title: "Gem dit split i PARI"
- Benefits: Gem personer og grupper · Behold historikken · Se hvem der skylder hvem · Inviter de andre
- Buttons: "Opret gratis konto" (primary), "Log ind" (secondary), "Ikke nu" (dismisses the card only, result stays on screen)

The completed split is already preserved through signup by the existing migration path; the card routes into that same flow, so after account creation the user lands on the saved expense.

All new strings go through the i18n dictionary in Danish and English.

## Technical notes

- New table `group_invitations` (id, group_id, token, join_code unique, created_by, expires_at, revoked_at) with grants and RLS: group owners/members manage their own invitations; a security-definer function `get_invitation_preview(token_or_code)` returns only group name, inviter display name and member count to anon, so the join page never exposes the group's data. Joining runs through a security-definer `accept_group_invitation(token_or_code)` that creates/links the caller's person row and inserts the group membership.
- Public route `src/routes/join.$token.tsx` (SSR, no auth gate) calls a public server function for the preview and an authenticated server function to accept.
- Pending invite token persisted in localStorage next to the guest split; consumed in the store's post-auth effect.
- QR code rendered with a small QR library added as a dependency.
- Avatar changes live in `src/components/pari/Avatar.tsx` (photo support, smarter initials, optional collision-aware disambiguation helper) plus `PersonChip`, `ParticipantPicker` and `split.items.tsx`.
- Result-screen card is a new component used only when `isGuest` is true.
