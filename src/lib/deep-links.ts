/**
 * Universal Link routing for the native shell.
 *
 * iOS hands `https://settoapp.lovable.app/...` links to the installed app; this
 * hook turns them into ordinary TanStack client navigations, both on cold start
 * (`App.getLaunchUrl`) and while the app is running/backgrounded
 * (`appUrlOpen`). Anything outside the allowlisted Setto paths is ignored, so a
 * link can never be turned into an arbitrary redirect target.
 *
 * No-op on the web: the browser already routes these URLs.
 */
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";

import { isNative } from "./native";
import { SETTO_WEB_ORIGIN } from "./native-auth";

/** Exactly the Setto links the app claims. */
const ALLOWED_PREFIXES = ["/invite/", "/join/", "/reset-password", "/auth/callback"] as const;

type Handled = { path: string; search: string; hash: string };

export function parseDeepLink(raw: string): Handled | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  // Scoped to the real Setto host only.
  if (url.origin !== SETTO_WEB_ORIGIN) return null;
  const matched = ALLOWED_PREFIXES.some(
    (prefix) => url.pathname === prefix || url.pathname.startsWith(prefix),
  );
  if (!matched) return null;
  return { path: url.pathname, search: url.search, hash: url.hash };
}

/**
 * Establishes the Supabase session carried by an auth link (recovery e-mail or
 * OAuth callback) before routing. Tokens are consumed here and never logged.
 */
async function consumeAuthParams(link: Handled): Promise<void> {
  const query = new URLSearchParams(link.search);
  const fragment = new URLSearchParams(link.hash.replace(/^#/, ""));

  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");
  if (accessToken && refreshToken) {
    await supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .catch(() => undefined);
    return;
  }

  const code = query.get("code");
  if (code) {
    await supabase.auth.exchangeCodeForSession(code).catch(() => undefined);
  }
}

export function useDeepLinks() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNative()) return;
    let active = true;
    let listener: { remove: () => Promise<void> } | undefined;

    const handle = async (raw: string) => {
      const link = parseDeepLink(raw);
      if (!link || !active) return;

      if (link.path === "/reset-password" || link.path === "/auth/callback") {
        await consumeAuthParams(link);
      }
      if (!active) return;

      // OAuth callbacks are completed by the auth-session listener; land the
      // user on the app home rather than the (web-only) callback screen.
      const to = link.path === "/auth/callback" ? "/home" : link.path;
      navigate({ to, replace: true }).catch(() => undefined);
    };

    void (async () => {
      const { App } = await import("@capacitor/app");
      listener = await App.addListener("appUrlOpen", ({ url }) => void handle(url));
      const launch = await App.getLaunchUrl().catch(() => null);
      if (launch?.url) void handle(launch.url);
    })();

    return () => {
      active = false;
      void listener?.remove().catch(() => undefined);
    };
  }, [navigate]);
}
