/**
 * Decides what tapping "Join group" on an invitation page must do.
 *
 * The store's `isGuest` is `authReady && !userId`, so it is *false* while the
 * session is still being restored. The invitation page finishes its own
 * preview load independently, so a visitor can tap the button before the
 * session check has settled — which used to send a signed-out visitor down the
 * redeem path, where nothing visible happens.
 */

import type { RedeemStatus } from "@/data/invitations";

export type JoinAction = "wait" | "signup" | "redeem";

export function joinAction(state: { authReady: boolean; userId: string | null }): JoinAction {
  if (!state.authReady) return "wait";
  return state.userId ? "redeem" : "signup";
}

/** A redeem that failed for a missing session must still lead to signup. */
export function redeemFallsBackToSignup(status: RedeemStatus): boolean {
  return status === "unauthenticated";
}
