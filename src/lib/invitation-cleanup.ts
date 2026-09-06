/**
 * What happens to a group invitation when an account is deleted.
 *
 * Mirrors public.delete_my_account(): the rule is scoped by invitation
 * OWNERSHIP and target, never by "every group the deleting user touched".
 */

export type InvitationRow = {
  /** Account that created the invitation. */
  ownerUserId: string | null;
  /** Person the invitation targets, if it is a person invitation. */
  personId: string | null;
  status: string;
  revoked: boolean;
  expired: boolean;
};

export type GroupFate = "deleted" | "transferred" | "untouched";

export type InvitationFate =
  | { kind: "cascade-deleted" }
  | { kind: "transferred"; ownerUserId: string }
  | { kind: "revoked" }
  | { kind: "kept" };

export function invitationFate(args: {
  invite: InvitationRow;
  groupFate: GroupFate;
  deletingUserId: string;
  /** People rows linked to the deleting account. */
  deletingUserPeople: string[];
  /** Account that takes over a transferred group. */
  successorUserId: string | null;
}): InvitationFate {
  const { invite, groupFate, deletingUserId, deletingUserPeople, successorUserId } = args;

  if (groupFate === "deleted") return { kind: "cascade-deleted" };

  const targetsDeletingUser = invite.personId !== null && deletingUserPeople.includes(invite.personId);
  const ownedByDeletingUser = invite.ownerUserId === deletingUserId;
  const usable = invite.status === "active" && !invite.revoked && !invite.expired;

  if (groupFate === "transferred" && ownedByDeletingUser && usable && !targetsDeletingUser) {
    return { kind: "transferred", ownerUserId: successorUserId! };
  }

  if (invite.status === "active" && (ownedByDeletingUser || targetsDeletingUser)) {
    return { kind: "revoked" };
  }

  return { kind: "kept" };
}

/** No invitation may keep a reference to the deleted account. */
export function residualOwnerReference(fate: InvitationFate, ownerUserId: string | null) {
  if (fate.kind === "cascade-deleted") return null;
  if (fate.kind === "transferred") return fate.ownerUserId;
  // Every remaining row owned by the deleted account is neutralised to NULL.
  return ownerUserId;
}
