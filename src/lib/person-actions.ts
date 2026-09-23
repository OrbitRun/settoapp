/**
 * Which invitation action a group person offers, kept as pure logic so the
 * rules are testable without rendering the sheet.
 *
 * A former member is invitable again: the invitation targets that exact
 * historical person, and accepting it reactivates the existing membership.
 */

export type PersonInviteState = {
  /** Already linked to a real account. */
  linked: boolean;
  /** An invitation was really shared and is still waiting. */
  pending: boolean;
  /** No longer an active member of the group. */
  former: boolean;
  isSelf: boolean;
};

export type PersonInviteAction = "invite" | "resend" | "invite-again";

export function personInviteAction(person: PersonInviteState): PersonInviteAction | null {
  if (person.isSelf) return null;
  // A former member is always invitable again, even when the historic person is
  // already linked to a real account: removal only ended the membership.
  if (person.former) return "invite-again";
  if (person.linked) return null;
  return person.pending ? "resend" : "invite";
}

export function personInviteLabelKey(action: PersonInviteAction) {
  if (action === "invite-again") return "invite.person.inviteAgain" as const;
  if (action === "resend") return "invite.person.resend" as const;
  return "invite.person.invite" as const;
}
