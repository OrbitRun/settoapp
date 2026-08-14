# People, group reuse, group management and invitations

Focused iteration. No redesign of working screens; no notifications, AI suggestions, paywall, logo or payment work.

## 1. Quick Split person count

Tapping + on "Antal personer" instantly creates placeholder participants — "Mig", "Person 2", "Person 3" … — for both guest and signed-in users. Today signed-in users get an empty name field instead, which blocks the fast path.

Placeholders are real person records so splits stay correct, and any participant can be renamed later by tapping the name (already supported). Tapping − removes the last participant; placeholder people created this way and never named are cleaned up when they end up in no split or group.

## 2. Reuse split people when saving as group

"Gem som gruppe" on the result screen carries the split's participants into the new-group screen. The user only needs to type a group name:

```text
Gruppenavn [            ]

Personer
  Jonas
  Mads          x
  Sofie         x

[ Opret gruppe ]
```

Participants can be removed or added before creating. The existing person records are reused — no duplicates.

## 3. Profile loses people management

Remove the "Personer" section from Profile. Profile keeps: Dit navn, Sprog, Valuta, Udseende, Sådan virker PARI, Log ud. No person records are deleted; people are managed from splits and groups only.

## 4. Group editing

Group Detail gets an overflow menu with "Redigér gruppe", opening an edit screen that supports: rename, add members, remove members (blocked with an explanation when the person has expenses in the group), and change the default split rule.

## 5. Archive and delete

Same menu adds:
- **Arkivér gruppe** — hides it from the active list, keeps all history, reversible from an "Arkiverede" section on the Groups screen.
- **Slet gruppe** — confirmation dialog spelling out that all expenses, splits and settlements in that group are permanently removed. Deletion is scoped to the group only; people records and other groups are untouched.

## 6 & 7. Invite to group

Group Detail keeps an "Inviter" action, opening the invitation sheet with Del invitation, Vis QR-kode, Kopiér link and an Invitationskode fallback — all four representing the same token (already the case today).

Invitation architecture: one token row per active invitation, tied to group, inviter, status and expiry, revocable. Public URL becomes `/invite/{token}` (internal group IDs are never in the link). The current `/join/{token}` path keeps working as a redirect so existing links stay valid.

## 8 & 9. Native-ready landing page

The invite landing page is built as the future Universal Link target: a lightweight public page showing

```text
Jonas inviterer dig til
Sommerhus 2026
PARI
[ Deltag i gruppen ]
```

plus a "Hent PARI" action (placeholder App Store link until the app ships). The token is stored locally when the visitor is signed out, so it survives signup/login and the join completes automatically afterwards — this already works and is extended to the new path. Deep-link metadata (apple-app-site-association placeholder, `og:` tags) is prepared so the iOS app can claim the domain later without changing links.

## Technical notes

- `ParticipantPicker.setCount`: drop the signed-in branch that opens the name field; create placeholder people for both modes, first person labelled "Mig".
- `createGroup` gains an optional `personIds` input so the result screen can pass existing participants instead of names; `/groups/new` accepts them via search params.
- Group mutations added to the store: `updateGroup` (name, default split), `addGroupMembers`, `removeGroupMember`, `archiveGroup`, `unarchiveGroup`, `deleteGroup` (cascading delete of that group's expenses, items, splits, settlements and activity).
- Invitations: add `status` to `group_invitations`, keep expiry/revocation; new route `src/routes/invite.$token.tsx` (public, SSR-friendly head tags) with `join.$token` redirecting to it.
- New/changed Danish + English strings added to the i18n dictionary in the same pass.
