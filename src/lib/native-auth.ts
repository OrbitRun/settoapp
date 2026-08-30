/**
 * Native (Capacitor/iOS) OAuth.
 *
 * The WKWebView is never navigated away to the provider. Instead the provider
 * page is opened in the system browser (SFSafariViewController via
 * `@capacitor/browser`), and the provider returns to the hosted HTTPS callback
 *
 *     https://settoapp.lovable.app/auth/callback
 *
 * which iOS hands back to the installed app as a Universal Link. The PKCE
 * `code` from that URL is exchanged for a Supabase session *inside* the app,
 * so tokens never transit an in-app web page.
 *
 * On the web this module is unused — `src/routes/auth.tsx` keeps the existing
 * browser redirect flow untouched.
 */
import { supabase } from "@/integrations/supabase/client";

import { isNative } from "./native";

export const SETTO_WEB_ORIGIN = "https://settoapp.lovable.app";
export const AUTH_CALLBACK_URL = `${SETTO_WEB_ORIGIN}/auth/callback`;

export type NativeAuthProvider = "google" | "apple";

export type NativeAuthResult =
  | { status: "success" }
  | { status: "cancelled" }
  | { status: "error"; reason: "provider" | "network" | "unknown"; message?: string | undefined };

const CALLBACK_TIMEOUT_MS = 180_000;

/** Extracts the PKCE code (or provider error) from a returned callback URL. */
export function readCallbackUrl(raw: string): { code?: string; error?: string } {
  try {
    const url = new URL(raw);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    const error = url.searchParams.get("error") ?? hash.get("error") ?? undefined;
    const code = url.searchParams.get("code") ?? hash.get("code") ?? undefined;
    return { ...(code ? { code } : {}), ...(error ? { error } : {}) };
  } catch {
    return {};
  }
}

function isCallback(raw: string): boolean {
  try {
    return new URL(raw).pathname === "/auth/callback";
  } catch {
    return false;
  }
}

/**
 * Runs the full native sign-in for one provider and resolves once the Supabase
 * session exists in the app (or the user cancelled / the provider failed).
 */
export async function nativeOAuthSignIn(provider: NativeAuthProvider): Promise<NativeAuthResult> {
  if (!isNative()) return { status: "error", reason: "unknown", message: "not native" };

  console.info("[NATIVE_OAUTH] provider start");
  const [{ Browser }, { App }] = await Promise.all([
    import("@capacitor/browser"),
    import("@capacitor/app"),
  ]);

  let authUrl: string;
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: AUTH_CALLBACK_URL,
        skipBrowserRedirect: true,
      },
    });
    if (error || !data?.url) {
      return { status: "error", reason: "provider", message: error?.message };
    }
    authUrl = data.url;
    console.info("[NATIVE_OAUTH] auth URL created");
  } catch (error) {
    return {
      status: "error",
      reason: "network",
      message: error instanceof Error ? error.message : undefined,
    };
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
        void (async () => {
          const { code, error } = readCallbackUrl(url);
          if (error || !code) {
            await finish({ status: "error", reason: "provider", message: error });
            return;
          }
          try {
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            if (exchangeError) {
              await finish({
                status: "error",
                reason: "provider",
                message: exchangeError.message,
              });
              return;
            }
            await finish({ status: "success" });
          } catch (thrown) {
            await finish({
              status: "error",
              reason: "network",
              message: thrown instanceof Error ? thrown.message : undefined,
            });
          }
        })();
      });

      // Dismissing the sheet without completing sign-in is a cancellation.
      closeListener = await Browser.addListener("browserFinished", () => {
        void finish({ status: "cancelled" });
      });

      timer = setTimeout(() => void finish({ status: "cancelled" }), CALLBACK_TIMEOUT_MS);

      try {
        await Browser.open({ url: authUrl, presentationStyle: "popover" });
      } catch (error) {
        await finish({
          status: "error",
          reason: "unknown",
          message: error instanceof Error ? error.message : undefined,
        });
      }
    })();
  });
}
