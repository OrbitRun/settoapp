# Fix member invitation + claim flow

Additive change only. No existing financial rows, person IDs, balances or policies are rewritten.

## What I verified first

In "Zia & Jonas" there are today three members:

```text
Jonas   linked to account       9 paid, 12 splits, 1 settlement
Zia     NOT linked to account   3 paid, 12 splits, 1 settlement   <- the real, historical Zia
Zia     linked to account       0 paid, 0 splits, 0 settlements   <- empty duplicate from the broken flow
```

So the duplicate is confirmed empty. It is reported, not deleted, until you confirm.

Root cause: the invitation only carries a group. On redemption the backend always creates a brand new person for the joining account instead of letting them take over a person that already exists in the group.

## The model (already present, just unused)

A group person is `people`; the login identity is the profile. A person that has no account simply has no linked profile. Claiming means setting that link on the existing person row — nothing else moves.

## Two explicit invitation types

**Invitér (on an existing person)** — the invitation stores the exact person being claimed. On accept, that person row gets linked to the accepting account. Member count is unchanged, and all history follows because the person ID never changes.

**+ Invitér ny person** — the invitation stores no person. On accept, a new person and membership are created, exactly as today. This is the only path that raises the member count.

## Personer tab

Each person keeps its current row and balance, with a state line and one action:

```text
Zia    Ikke tilknyttet konto     [ Invitér ]
Zia    Invitation sendt          [ Send igen ]
Jonas  Tilknyttet
```

Below the list: `+ Invitér ny person`, visually separate. Both actions open the existing invitation sheet (link, QR, copy, code) — no redesign.

## Landing page and auth round-trip

`/invite/{token}` shows who invited you, the group, and — for a person invitation — the name you are about to claim ("Du bliver tilknyttet Zia"). Signed out, the token is stored locally, survives signup/verification/login/reset, and the claim completes automatically on return. Signed in, one tap claims.

Outcomes get their own message: joined, claimed, already a member, person already linked to another account, expired, revoked, invalid.

## Safety rules enforced server-side

- The person claimed is read from the invitation row, never from the client.
- A person that already has a linked account cannot be claimed: "Denne person er allerede tilknyttet en konto."
- Never match by name; email is not used as a claim key.
- The invitation is marked used after a successful claim; expiry and revocation keep working.
- One account cannot end up as two people in the same group.

## Technical notes

- Migration (additive): add nullable `person_id` to `group_invitations` (FK to `people`), plus a partial unique index so one person has at most one active invitation. No column is dropped or renamed.
- New security-definer RPC `claim_group_invitation(_code)` returning `(status, group_id)`:
  - person-scoped invitation → verify the person belongs to the invitation's group, verify `linked_profile_id is null` (or already equals the caller → `already_member`), verify the caller is not already another person in that group, then `update people set linked_profile_id = auth.uid()` and mark the invitation used.
  - no person → current `redeem_group_invitation` behaviour, unchanged.
  Existing `redeem_group_invitation` stays in place for old links.
- `get_invitation_preview` gains the target person name so the landing page can state what will be claimed.
- RLS: no policy changes. `is_group_participant` already grants access through `people.linked_profile_id`, so the claimed person's history becomes visible to Zia the moment the link is set, without widening anything.
- Client: `src/data/invitations.ts` gains `ensurePersonInvitation(groupId, personId)` and `claimInvitation(code)`; `InviteSheet` takes an optional person; `groups.$groupId.tsx` People tab gets state + actions; `invite.$token.tsx` uses the new statuses. Danish and English strings added in the same pass.

## Verification

Before/after counts for groups, members, people IDs, expenses, splits, settlements and balances are compared and reported. Existing-person claim must keep the member count at 2; new-person invite must move 2 → 3. If any financial figure moves, I stop and report instead of continuing.

## Duplicate member

Reported only. On your go-ahead the empty duplicate Zia (no expenses, splits, settlements or activity) is removed and its account is linked to the original historical Zia; the historical Zia person is never touched otherwise.
