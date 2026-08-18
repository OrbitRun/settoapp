/**
 * Translates backend auth failures into calm, localized states.
 * Raw provider/database messages must never reach the UI.
 */

export type AuthErrorKey =
  | "auth.err.invalidCredentials"
  | "auth.err.emailTaken"
  | "auth.err.weakPassword"
  | "auth.err.notConfirmed"
  | "auth.err.rateLimit"
  | "auth.err.linkExpired"
  | "auth.err.network"
  | "auth.error";

export function authErrorKey(error: unknown): AuthErrorKey {
  const raw = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
  if (!raw) return "auth.error";
  if (raw.includes("invalid login") || raw.includes("invalid credentials")) {
    return "auth.err.invalidCredentials";
  }
  if (raw.includes("already registered") || raw.includes("already been registered")) {
    return "auth.err.emailTaken";
  }
  if (raw.includes("password") && (raw.includes("short") || raw.includes("weak") || raw.includes("least"))) {
    return "auth.err.weakPassword";
  }
  if (raw.includes("pwned") || raw.includes("compromised")) return "auth.err.weakPassword";
  if (raw.includes("not confirmed") || raw.includes("email not confirmed")) {
    return "auth.err.notConfirmed";
  }
  if (raw.includes("rate limit") || raw.includes("too many")) return "auth.err.rateLimit";
  if (raw.includes("expired") || raw.includes("invalid token") || raw.includes("otp")) {
    return "auth.err.linkExpired";
  }
  if (raw.includes("fetch") || raw.includes("network")) return "auth.err.network";
  return "auth.error";
}

/** Only same-origin app paths may be used as post-auth destinations. */
export function safeRedirectPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}
