/**
 * Native (Capacitor/iOS) OAuth — through the Lovable auth broker (Google) and
 * the Setto-owned backend Apple provider.
 *
 * Transport: `ASWebAuthenticationSession` with HTTPS callback matching
 * (`SettoAuthSession` native plugin). The provider redirect to
 *
 *     https://open.setto.dk/auth/callback
 *
 * is intercepted by the authentication session itself and handed straight back
 * to the app, which dismisses the sheet automatically. The callback is NOT a
 * Universal Link hand-off any more: the in-app browser plugin, the URL-open
 * listener and the close-race grace window are all out of the OAuth path.
 *
 * This module remains the SOLE consumer of the OAuth callback credentials;
 * `src/lib/deep-links.ts` only observes `/auth/callback`.
 *
 * On the web this module is unused — `src/routes/auth.index.tsx` keeps the
 * existing `lovable.auth.signInWithOAuth()` browser flow untouched.
 */
import { supabase } from "@/integrations/supabase/client";

import { isNative } from "./native";
import { SettoAuthSession } from "./native-auth-session";

/** Canonical web/auth origin. Primary custom domain; serves 200 directly. */
export const SETTO_WEB_ORIGIN = "https://setto.dk";
/** Previous canonical origin — still accepted for links already issued. */
export const SETTO_LEGACY_WEB_ORIGIN = "https://settoapp.lovable.app";
/**
 * Dedicated hand-off origin for native authentication.
 *
 * The whole OAuth journey runs on `setto.dk`, so the final callback must be a
 * separate origin the native authentication session can match on. It stays an
 * Associated Domain for the app.
 */
export const SETTO_APPLINK_ORIGIN = "https://open.setto.dk";
/** Web OAuth return target — unchanged. */
export const AUTH_CALLBACK_URL = `${SETTO_WEB_ORIGIN}/auth/callback`;
/** Native OAuth return target — matched by ASWebAuthenticationSession. */
export const NATIVE_AUTH_CALLBACK_URL = `${SETTO_APPLINK_ORIGIN}/auth/callback`;
/** Broker initiate endpoint — same path the cloud-auth-js package defaults to. */
export const OAUTH_BROKER_URL = `${SETTO_WEB_ORIGIN}/~oauth/initiate`;

export type NativeAuthProvider = "google" | "apple";

export type NativeAuthResult =
  | { status: "success" }
  | { status: "cancelled" }
  | { status: "error"; reason: "provider" | "network" | "unknown"; message?: string | undefined };

function generateState(): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    return [...crypto.getRandomValues(new Uint8Array(16))]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export type CallbackPayload = {
  state?: string;
  accessToken?: string;
  refreshToken?: string;
  code?: string;
  error?: string;
};

/** Reads the provider response from a returned callback URL (query or fragment). */
export function readCallbackUrl(raw: string): CallbackPayload {
  try {
    const url = new URL(raw);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    const pick = (key: string) => url.searchParams.get(key) ?? hash.get(key) ?? undefined;
    const error = pick("error_description") ?? pick("error");
    const state = pick("state");
    const accessToken = pick("access_token");
    const refreshToken = pick("refresh_token");
    const code = pick("code");
    return {
      ...(state ? { state } : {}),
      ...(accessToken ? { accessToken } : {}),
      ...(refreshToken ? { refreshToken } : {}),
      ...(code ? { code } : {}),
      ...(error ? { error } : {}),
    };
  } catch {
    return {};
  }
}

/** Origins whose /auth/callback the native flow accepts back from the sheet. */
const CALLBACK_ORIGINS = [SETTO_APPLINK_ORIGIN, SETTO_WEB_ORIGIN] as const;

export function isCallback(raw: string): boolean {
  try {
    const url = new URL(raw);
    // Exact origin + path only — never accept arbitrary hosts with the same path.
    return (
      CALLBACK_ORIGINS.includes(url.origin as (typeof CALLBACK_ORIGINS)[number]) &&
      url.pathname === "/auth/callback"
    );
  } catch {
    return false;
  }
}

/** Builds the broker authorization URL for one provider. */
export function buildBrokerUrl(provider: NativeAuthProvider, state: string): string {
  const params = new URLSearchParams({
    provider,
    redirect_uri: NATIVE_AUTH_CALLBACK_URL,
    state,
  });
  return `${OAUTH_BROKER_URL}?${params.toString()}`;
}

/** What a returned callback URL asks the app to do — pure, no side effects. */
export type CallbackDecision =
  | { kind: "error"; message: string }
  | { kind: "tokens"; accessToken: string; refreshToken: string }
  | { kind: "code"; code: string };

/**
 * Validates a returned callback URL and classifies the credential it carries.
 * `expectedState` is enforced only for the broker flow, which mints it here;
 * the Apple backend flow's state is owned and verified by the Supabase client.
 */
export function evaluateCallback(raw: string, expectedState?: string): CallbackDecision {
  if (!isCallback(raw)) return { kind: "error", message: "unexpected callback" };
  const payload = readCallbackUrl(raw);
  if (payload.error) return { kind: "error", message: payload.error };
  if (expectedState && payload.state !== expectedState) {
    return { kind: "error", message: "state mismatch" };
  }
  if (payload.accessToken && payload.refreshToken) {
    return { kind: "tokens", accessToken: payload.accessToken, refreshToken: payload.refreshToken };
  }
  if (payload.code) return { kind: "code", code: payload.code };
  return { kind: "error", message: "no tokens received" };
}

/**
 * Native sign-in for Google — unchanged Lovable broker contract.
 */
export async function nativeOAuthSignIn(provider: NativeAuthProvider): Promise<NativeAuthResult> {
  if (!isNative()) return { status: "error", reason: "unknown", message: "not native" };

  console.info(`[NATIVE_OAUTH] provider start ${provider}`);
  const state = generateState();
  let authUrl: string;
  try {
    authUrl = buildBrokerUrl(provider, state);
    console.info("[NATIVE_OAUTH] broker auth URL created");
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    console.info(`[NATIVE_OAUTH] broker error ${message ?? "unknown"}`);
    return { status: "error", reason: "unknown", message };
  }

  return runNativeAuthFlow(authUrl, state);
}

/**
 * Native Sign in with Apple through the Setto-owned backend Apple provider
 * (BYOC Services ID `dk.setto.app.web`). The authorize URL is obtained with
 * `skipBrowserRedirect` so the WKWebView never navigates away; the native
 * authentication session handles Apple and returns the PKCE `code`, which this
 * module exchanges exactly once.
 */
export async function nativeAppleSignIn(): Promise<NativeAuthResult> {
  if (!isNative()) return { status: "error", reason: "unknown", message: "not native" };

  console.info("[NATIVE_OAUTH] provider start apple (backend)");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "apple",
    options: { redirectTo: NATIVE_AUTH_CALLBACK_URL, skipBrowserRedirect: true },
  });
  if (error || !data?.url) {
    const message = error?.message;
    console.info(`[NATIVE_OAUTH] authorize error ${message ?? "no url"}`);
    return { status: "error", reason: "provider", message };
  }
  console.info("[NATIVE_OAUTH] backend auth URL received");
  return runNativeAuthFlow(data.url);
}

/**
 * Runs the native authentication session and establishes the Supabase session
 * from the callback it returns. Only safe lifecycle markers are logged — never
 * the callback URL, a code or a token.
 */
async function runNativeAuthFlow(
  authUrl: string,
  expectedState?: string,
): Promise<NativeAuthResult> {
  let session: Awaited<ReturnType<typeof SettoAuthSession.startAuthentication>>;
  try {
    console.info("[NATIVE_OAUTH] auth session starting");
    session = await SettoAuthSession.startAuthentication({ url: authUrl });
  } catch (thrown) {
    const message = thrown instanceof Error ? thrown.message : undefined;
    console.info(`[NATIVE_OAUTH] auth session error ${message ?? "unknown"}`);
    return { status: "error", reason: "unknown", message };
  }

  if (session.status === "cancelled") {
    console.info("[NATIVE_OAUTH] finish cancelled");
    return { status: "cancelled" };
  }
  if (session.status !== "success") {
    console.info("[NATIVE_OAUTH] auth session error");
    return { status: "error", reason: "provider", message: "auth session failed" };
  }

  console.info("[NATIVE_OAUTH] callback received");
  const decision = evaluateCallback(session.callbackUrl, expectedState);
  if (decision.kind === "error") {
    console.info(`[NATIVE_OAUTH] callback error ${decision.message}`);
    return { status: "error", reason: "provider", message: decision.message };
  }

  try {
    console.info("[NATIVE_OAUTH] session establishment starting");
    const { error } =
      decision.kind === "tokens"
        ? await supabase.auth.setSession({
            access_token: decision.accessToken,
            refresh_token: decision.refreshToken,
          })
        : await supabase.auth.exchangeCodeForSession(decision.code);
    if (error) {
      console.info(`[NATIVE_OAUTH] session error ${error.message}`);
      return { status: "error", reason: "provider", message: error.message };
    }
    console.info("[NATIVE_OAUTH] finish success");
    return { status: "success" };
  } catch (thrown) {
    const message = thrown instanceof Error ? thrown.message : undefined;
    console.info(`[NATIVE_OAUTH] session error ${message ?? "unknown"}`);
    return { status: "error", reason: "network", message };
  }
}
