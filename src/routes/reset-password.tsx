import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PrimaryButton, SecondaryButton } from "@/components/pari/Buttons";
import { supabase } from "@/integrations/supabase/client";
import { authMessageKey } from "@/lib/auth-errors";
import { isNative } from "@/lib/native";
import { SETTO_APPLINK_ORIGIN } from "@/lib/native-auth";
import { useT } from "@/lib/i18n";

/**
 * Password reset landing page. The provider's recovery link creates a
 * short-lived session; we only call updateUser here. Nothing in this flow
 * touches profiles, people, memberships or any financial record.
 */
export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset password — Setto" },
      { name: "description", content: "Choose a new password for your Setto account." },
      { property: "og:title", content: "Reset password — Setto" },
      {
        property: "og:description",
        content: "Choose a new password for your Setto account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordScreen,
});

type LinkState = "checking" | "ready" | "invalid";

function isIOSBrowser() {
  if (typeof window === "undefined" || !window.navigator) return false;
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !isNative();
}

function openInSettoUrl() {
  const hash = typeof window !== "undefined" ? window.location.hash : "";
  const search = typeof window !== "undefined" ? window.location.search : "";
  return `${SETTO_APPLINK_ORIGIN}/reset-password${search}${hash}`;
}

function ResetPasswordScreen() {
  const t = useT();
  const navigate = useNavigate();
  const [linkState, setLinkState] = useState<LinkState>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    // An error carried in the URL fragment means expired / already used / invalid.
    const hash = typeof window === "undefined" ? "" : window.location.hash;
    if (hash.includes("error")) {
      setLinkState("invalid");
      return;
    }

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setLinkState(data.session ? "ready" : "invalid");
    };

    // The recovery session may land a tick after mount.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session) setLinkState("ready");
    });
    const timer = window.setTimeout(() => void check(), 400);

    return () => {
      active = false;
      window.clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 6) {
      toast.error(t("auth.passwordShort"));
      return;
    }
    if (password !== confirm) {
      toast.error(t("auth.passwordMismatch"));
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success(t("auth.passwordUpdated"));
      navigate({ to: "/home" });
    } catch (error) {
      toast.error(t(authMessageKey(error)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center bg-background px-6 pt-[env(safe-area-inset-top)]">
      <div className="mx-auto w-full max-w-[400px] py-14">
        {linkState === "checking" ? (
          <p className="text-sm text-muted-foreground">{t("auth.checkingLink")}</p>
        ) : linkState === "invalid" ? (
          <>
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.03em]">
              {t("auth.linkInvalidTitle")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{t("auth.linkInvalidBody")}</p>
            <div className="mt-8">
              <SecondaryButton onClick={() => navigate({ to: "/auth" })}>
                {t("auth.backToSignIn")}
              </SecondaryButton>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.03em]">
              {t("auth.resetTitle")}
            </h1>
            {isIOSBrowser() ? (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  Åbn linket i Setto-appen for at vælge en ny adgangskode.
                </p>
                <a
                  href={openInSettoUrl()}
                  className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl bg-accent px-4 text-[15px] font-semibold text-white transition-colors hover:bg-accent/90"
                >
                  Åbn i Setto
                </a>
                <div className="relative mt-8">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase text-muted-foreground">
                    <span className="bg-background px-2">Eller fortsæt her</span>
                  </div>
                </div>
              </>
            ) : null}
            <form onSubmit={submit} className="mt-8 space-y-3">
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t("auth.newPassword")}
                autoComplete="new-password"
                className="h-14 w-full rounded-2xl bg-surface px-4 text-[15px] outline-none ring-accent/40 focus:ring-2"
              />
              <input
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                placeholder={t("auth.confirmPassword")}
                autoComplete="new-password"
                className="h-14 w-full rounded-2xl bg-surface px-4 text-[15px] outline-none ring-accent/40 focus:ring-2"
              />
              <p className="px-1 text-[13px] text-muted-foreground">{t("auth.passwordRules")}</p>
              <PrimaryButton type="submit" disabled={busy}>

                {t("auth.setPassword")}
              </PrimaryButton>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
