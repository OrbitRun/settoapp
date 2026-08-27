import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { readPendingInvite } from "@/data/invitations";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";

/**
 * The single hosted OAuth return target: https://settoapp.lovable.app/auth/callback
 *
 * On the web it finishes the provider round-trip and continues to the pending
 * invitation (if any) or the app home. On iOS the very same URL is claimed as a
 * Universal Link, so the installed app receives it instead and completes the
 * PKCE exchange natively — this screen is then only ever seen inside the system
 * browser sheet, which closes itself immediately afterwards.
 *
 * It never redirects anywhere except fixed in-app routes.
 */
export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Signing in — Setto" },
      { name: "description", content: "Completing your Setto sign-in." },
      { property: "og:title", content: "Signing in — Setto" },
      { property: "og:description", content: "Completing your Setto sign-in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthCallbackScreen,
});

function AuthCallbackScreen() {
  const t = useT();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    const finish = async () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("error")) {
        setFailed(true);
        return;
      }

      const code = params.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!active) return;
        if (error) {
          setFailed(true);
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (!data.session) {
        setFailed(true);
        return;
      }

      const pending = readPendingInvite();
      navigate(
        pending
          ? { to: "/invite/$token", params: { token: pending }, replace: true }
          : { to: "/home", replace: true },
      ).catch(() => undefined);
    };

    void finish();
    return () => {
      active = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (!failed) return;
    const timer = window.setTimeout(() => void navigate({ to: "/auth", replace: true }), 1200);
    return () => window.clearTimeout(timer);
  }, [failed, navigate]);

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-6">
      <p className="text-sm text-muted-foreground">
        {failed ? t("auth.googleFailed") : t("auth.checkingLink")}
      </p>
    </div>
  );
}
