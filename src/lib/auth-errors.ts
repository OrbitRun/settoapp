/**
 * Turns raw auth-provider errors into localized, non-technical messages.
 * Raw backend strings must never reach the UI.
 */

export type AuthMessageKey =
  | "auth.invalidCredentials"
  | "auth.emailInUse"
  | "auth.weakPassword"
  | "auth.emailNotConfirmed"
  | "auth.rateLimited"
  | "auth.offline"
  | "auth.linkInvalidBody"
  | "auth.error";

export function authMessageKey(error: unknown): AuthMessageKey {
  const raw = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
  if (!raw) return "auth.error";
  if (raw.includes("invalid login") || raw.includes("invalid credentials")) {
    return "auth.invalidCredentials";
  }
  if (raw.includes("already registered") || raw.includes("already been registered")) {
    return "auth.emailInUse";
  }
  if (raw.includes("password") && (raw.includes("short") || raw.includes("at least"))) {
    return "auth.weakPassword";
  }
  if (raw.includes("weak password")) return "auth.weakPassword";
  if (raw.includes("email not confirmed") || raw.includes("not confirmed")) {
    return "auth.emailNotConfirmed";
  }
  if (raw.includes("rate limit") || raw.includes("too many")) return "auth.rateLimited";
  if (raw.includes("failed to fetch") || raw.includes("network")) return "auth.offline";
  if (raw.includes("expired") || raw.includes("invalid token") || raw.includes("otp")) {
    return "auth.linkInvalidBody";
  }
  return "auth.error";
}
