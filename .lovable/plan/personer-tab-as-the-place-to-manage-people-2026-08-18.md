# Personer tab as the place to manage people

UI/UX only. All member, invitation, removal and balance logic is reused exactly as it is today.

## 1. Calm, tappable person list

Each row in Group > Personer becomes one tappable row with a subtle chevron:

```text
Jonas   Dig
Tilknyttet                 -887,65 kr.   >

Zia
Invitation sendt           +887,65 kr.   >
```

No inline buttons anymore — the current "Invitér / Send igen" button moves into the detail sheet. Status line, balance, amount colours, spacing and typography stay exactly as today. Former members keep the "Tidligere medlem" label.

The bottom action becomes "+ Tilføj person" (today it reads "+ Invitér ny person"), opening the same flow it opens now.

## 2. Person detail bottom sheet

Tapping a row opens a bottom sheet in the existing app sheet style:

```text
Zia

Status      Invitation sendt
Saldo       +887,65 kr.

[ Send invitation igen ]
[ Redigér navn ]
[ Fjern fra gruppe ]
```

Actions shown per state:

| State | Actions |
| --- | --- |
| You (current user) | Redigér navn only — no invite, no removal |
| Linked account | Redigér navn; Fjern fra gruppe (owner) |
| No account yet | Invitér; Redigér navn; Fjern fra gruppe |
| Invitation sent | Send invitation igen; Redigér navn; Fjern fra gruppe |
| Former member | Status only (read-only) |

Opening the sheet never touches invitation state — the existing rule that only a completed share/copy marks an invitation as sent stays untouched.

"Redigér navn" is an inline name field in the sheet that calls the existing rename action; it changes the display name only, same person record, same history. "Fjern fra gruppe" opens the existing confirmation and calls the existing safe-removal path with its current messages (deactivated vs. removed, cannot remove self, not allowed).

## 3. Regler tab

Unchanged content: Standardfordeling, Valuta. The link at the bottom is relabelled from "Redigér gruppe" to "Gruppeindstillinger" and still opens the same screen. The duplicate "Redigér gruppe" link under the Expenses tab is relabelled the same way.

## Technical notes

- New component `src/components/pari/PersonSheet.tsx` — presentation only; receives person id, status, balance and calls existing `pari.renamePerson`, `pari.removeGroupMember`, and the existing `InviteSheet` for invite/resend.
- `src/routes/groups.$groupId.tsx`: People tab rows become buttons with a chevron; row-level invite button removed; sheet wiring added. Pending-invite detection (`fetchActiveInvitations`) and `onSent` handling reused as-is.
- `src/lib/i18n.tsx`: add keys for the sheet title/labels ("Saldo", "Redigér navn", "Fjern fra gruppe", "+ Tilføj person", "Gruppeindstillinger") in Danish and English.
- No changes to store financial functions, invitation backend, RLS, or the edit-group screen's own logic.
