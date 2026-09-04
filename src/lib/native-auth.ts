/**
 * Native (Capacitor/iOS) OAuth — through the Lovable auth broker.
 *
 * The managed Supabase project holds no Google/Apple provider secrets; those
 * credentials live behind the Lovable OAuth broker that the web build uses via
 * `lovable.auth.signInWithOAuth()`. `@lovable.dev/cloud-auth-js` cannot be used
 * as-is on native: outside an iframe it completes the flow by assigning
 * `window.location.href`, which would navigate the WKWebView away from the app.
 *
 * So this module follows the exact same broker contract the package implements:
 *
 *     GET <origin>/~oauth/initiate?provider=<p>&redirect_uri=<uri>&state=<s>
 *
 * opened in the system browser (SFSafariViewController via `@capacitor/browser`).
 * The broker returns to the hosted HTTPS callback
 *
 *     https://setto.dk/auth/callback
 *
 * which iOS hands back to the installed app as a Universal Link, carrying
 * `state` plus `access_token`/`refresh_token` (or `error`). The session is then
 * established in-app with `supabase.auth.setSession()`.
 *
 * This module is the SOLE consumer of the native `/auth/callback` deep link;
 * `src/lib/deep-links.ts` only observes it.
 *
 * On the web this module is unused — `src/routes/auth.index.tsx` keeps the
 * existing `lovable.auth.signInWithOAuth()` browser flow untouched.
 */
import { supabase } from "@/integrations/supabase/client";

import { isNative } from "./native";

/** Canonical web/auth origin. Primary custom domain; serves 200 directly. */
export const SETTO_WEB_ORIGIN = "https://setto.dk";
/** Previous canonical origin — still accepted for links already issued. */
export const SETTO_LEGACY_WEB_ORIGIN = "https://settoapp.lovable.app";
/** Dedicated Universal Link origin for native hand-off. OAuth must keep using the web origin. */
export const SETTO_APPLINK_ORIGIN = "https://open.setto.dk";
export const AUTH_CALLBACK_URL = `${SETTO_WEB_ORIGIN}/auth/callback`;
/** Broker initiate endpoint — same path the cloud-auth-js package defaults to. */
export const OAUTH_BROKER_URL = `${SETTO_WEB_ORIGIN}/~oauth/initiate`;

export type NativeAuthProvider = "google" | "apple";

export type NativeAuthResult =
  | { status: "success" }
  | { status: "cancelled" }
  | { status: "error"; reason: "provider" | "network" | "unknown"; message?: string | undefined };

const CALLBACK_TIMEOUT_MS = 180_000;

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
  error?: string;
};

/** Reads the broker's response from a returned callback URL (query or fragment). */
export function readCallbackUrl(raw: string): CallbackPayload {
  try {
    const url = new URL(raw);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    const pick = (key: string) => url.searchParams.get(key) ?? hash.get(key) ?? undefined;
    const error = pick("error_description") ?? pick("error");
    const state = pick("state");
    const accessToken = pick("access_token");
    const refreshToken = pick("refresh_token");
    return {
      ...(state ? { state } : {}),
      ...(accessToken ? { accessToken } : {}),
      ...(refreshToken ? { refreshToken } : {}),
      ...(error ? { error } : {}),
    };
  } catch {
    return {};
  }
}

export function isCallback(raw: string): boolean {
  try {
    const url = new URL(raw);
    // Exact origin + path only — never accept arbitrary hosts with the same path.
    return url.origin === SETTO_WEB_ORIGIN && url.pathname === "/auth/callback";
  } catch {
    return false;
  }
}

/** Builds the broker authorization URL for one provider. */
export function buildBrokerUrl(provider: NativeAuthProvider, state: string): string {
  const params = new URLSearchParams({
    provider,
    redirect_uri: AUTH_CALLBACK_URL,
    state,
  });
  return `${OAUTH_BROKER_URL}?${params.toString()}`;
}

/**
 * Runs the full native sign-in for one provider and resolves once the Supabase
 * session exists in the app (or the user cancelled / the broker failed).
 */
export async function nativeOAuthSignIn(provider: NativeAuthProvider): Promise<NativeAuthResult> {
  if (!isNative()) return { status: "error", reason: "unknown", message: "not native" };

  console.info(`[NATIVE_OAUTH] provider start ${provider}`);
  const [{ Browser }, { App }] = await Promise.all([
    import("@capacitor/browser"),
    import("@capacitor/app"),
  ]);

  console.info("[NATIVE_OAUTH] broker request starting");
  const state = generateState();
  let authUrl: string;
  try {
    authUrl = buildBrokerUrl(provider, state);
    console.info("[NATIVE_OAUTH] broker auth URL received");
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    console.info(`[NATIVE_OAUTH] broker error ${message ?? "unknown"}`);
    return { status: "error", reason: "unknown", message };
  }

  return new Promise<NativeAuthResult>((resolve) => {
    let settled = false;
    let urlListener: { remove: () => Promise<void> } | undefined;
    let closeListener: { remove: () => Promise<void> } | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = async (result: NativeAuthResult) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      await urlListener?.remove().catch(() => undefined);
      await closeListener?.remove().catch(() => undefined);
      await Browser.close().catch(() => undefined);
      resolve(result);
    };

    void (async () => {
      urlListener = await App.addListener("appUrlOpen", ({ url }) => {
        if (!isCallback(url)) return;
        console.info("[NATIVE_OAUTH] appUrlOpen received");
        void (async () => {
          const payload = readCallbackUrl(url);
          console.info("[NATIVE_OAUTH] callback recognized");

          if (payload.error) {
            console.info(`[NATIVE_OAUTH] callback error ${payload.error}`);
            await finish({ status: "error", reason: "provider", message: payload.error });
            return;
          }
          if (payload.state && payload.state !== state) {
            console.info("[NATIVE_OAUTH] callback error state mismatch");
            await finish({ status: "error", reason: "provider", message: "state mismatch" });
            return;
          }
          if (!payload.accessToken || !payload.refreshToken) {
            console.info("[NATIVE_OAUTH] callback error no tokens received");
            await finish({ status: "error", reason: "provider", message: "no tokens received" });
            return;
          }

          try {
            console.info("[NATIVE_OAUTH] session establishment starting");
            const { error } = await supabase.auth.setSession({
              access_token: payload.accessToken,
              refresh_token: payload.refreshToken,
            });
            if (error) {
              console.info(`[NATIVE_OAUTH] session error ${error.message}`);
              await finish({ status: "error", reason: "provider", message: error.message });
              return;
            }
            console.info("[NATIVE_OAUTH] session establishment success");
            console.info("[NATIVE_OAUTH] finish success");
            await finish({ status: "success" });
          } catch (thrown) {
            const message = thrown instanceof Error ? thrown.message : undefined;
            console.info(`[NATIVE_OAUTH] session error ${message ?? "unknown"}`);
            await finish({ status: "error", reason: "network", message });
          }
        })();
      });

      // Dismissing the sheet without completing sign-in is a cancellation.
      closeListener = await Browser.addListener("browserFinished", () => {
        console.info("[NATIVE_OAUTH] browserFinished");
        console.info("[NATIVE_OAUTH] finish cancelled");
        void finish({ status: "cancelled" });
      });

      timer = setTimeout(() => {
        console.info("[NATIVE_OAUTH] finish cancelled");
        void finish({ status: "cancelled" });
      }, CALLBACK_TIMEOUT_MS);

      try {
        await Browser.open({ url: authUrl, presentationStyle: "popover" });
        console.info("[NATIVE_OAUTH] browser opened");
      } catch (error) {
        const message = error instanceof Error ? error.message : undefined;
        console.info(`[NATIVE_OAUTH] broker error ${message ?? "unknown"}`);
        await finish({ status: "error", reason: "unknown", message });
      }
    })();
  });
}
