/**
 * The person-invitation claim rules, mirrored as pure logic so the invariants
 * are testable without a database round trip. The SQL in
 * public.claim_group_invitation() follows exactly this ordering.
 *
 * Core invariant: a used, revoked or expired invitation can NEVER reactivate a
 * membership that was removed after the original claim.
 */

export type InviteState = {
  /** 'active' | 'used' | 'revoked' | ... */
  status: string;
  revoked: boolean;
  expired: boolean;
};

export type ClaimContext = {
  invite: InviteState;
  /** The invitation's person row exists. */
  personExists: boolean;
  /** Account the invited person is linked to, if any. */
  personLinkedTo: string | null;
  /** A historical group_members row exists for (group, person). */
  membershipExists: boolean;
  /** That membership is currently removed. */
  membershipRemoved: boolean;
  /** The caller is already another active person in this group. */
  callerActiveElsewhereInGroup: boolean;
  callerId: string | null;
};

export type ClaimOutcome =
  | "unauthenticated"
  | "invalid"
  | "already_member"
  | "person_taken"
  | "revoked"
  | "expired"
  | "claimed";

export const inviteIsValid = (invite: InviteState) =>
  !invite.revoked && invite.status === "active" && !invite.expired;

/** Whether the outcome performs a reactivation mutation. */
export const reactivates = (outcome: ClaimOutcome) => outcome === "claimed";

export function claimOutcome(ctx: ClaimContext): ClaimOutcome {
  if (!ctx.callerId) return "unauthenticated";
  if (!ctx.personExists) return "invalid";
  if (!ctx.membershipExists) return "invalid";

  const valid = inviteIsValid(ctx.invite);

  if (ctx.personLinkedTo === ctx.callerId) {
    // Harmless idempotency only while the membership is still active.
    if (!ctx.membershipRemoved) return "already_member";
    if (!valid) return ctx.expiredOnly() ? "expired" : "revoked";
    return "claimed";
  }

  if (ctx.personLinkedTo !== null) return "person_taken";
  if (ctx.invite.revoked || ctx.invite.status !== "active") return "revoked";
  if (ctx.invite.expired) return "expired";
  if (ctx.callerActiveElsewhereInGroup) return "already_member";
  return "claimed";
}
