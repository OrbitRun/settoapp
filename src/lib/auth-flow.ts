/**
 * Small pure helpers for auth/session gating decisions, kept separate so they
 * can be tested without rendering the whole app.
 */

export type SignupOutcome = "signed-in" | "no-session";

/**
 * Signup only continues into the app when a real session exists. Without one
 * we never navigate to /home — the user stays on the auth screen.
 */
export function signupOutcome(
  signUpSession: unknown | null | undefined,
  currentSession: unknown | null | undefined,
): SignupOutcome {
  return signUpSession || currentSession ? "signed-in" : "no-session";
}

/** Authenticated screens render children only once the account data is ready. */
export function shouldRenderAuthedChildren(state: {
  authReady: boolean;
  isGuest: boolean;
  loading: boolean;
}): boolean {
  return state.authReady && !state.isGuest && !state.loading;
}
