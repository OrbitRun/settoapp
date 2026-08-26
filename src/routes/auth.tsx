import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BottomSheet } from "@/components/pari/BottomSheet";
import { PrimaryButton, SecondaryButton } from "@/components/pari/Buttons";
import { readPendingInvite } from "@/data/invitations";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { authMessageKey } from "@/lib/auth-errors";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { mode?: "signup" } =>
    search["mode"] === "signup" ? { mode: "signup" } : {},

  head: () => ({
    meta: [
      { title: "Sign in — Setto" },
      { name: "description", content: "Sign in to Setto to split and settle shared expenses." },
      { property: "og:title", content: "Sign in — Setto" },
      {
        property: "og:description",
        content: "Sign in to Setto to split and settle shared expenses.",
      },
    ],
  }),
  component: AuthScreen,
});

function AuthScreen() {
  const t = useT();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(
    search.mode === "signup" ? "signup" : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [hasPendingInvite, setHasPendingInvite] = useState(false);

  useEffect(() => {
    setHasPendingInvite(Boolean(readPendingInvite()));
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home" });
    });
  }, [navigate]);

  const sendReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setResetBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetOpen(false);
      toast.success(t("auth.resetSent"));
    } catch (error) {
      toast.error(t(authMessageKey(error)));
    } finally {
      setResetBusy(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name.trim() || email.split("@")[0] },
          },
        });
        if (error) throw error;
        const { data: session } = await supabase.auth.getSession();
        if (session.session) navigate({ to: "/home" });
        else toast.success(t("auth.checkEmail"));
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/home" });
      }
    } catch (error) {
      toast.error(t(authMessageKey(error)));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Web: unchanged browser redirect through the Lovable broker.
   * Native: system-browser auth session returning through the hosted
   * Universal Link callback (see src/lib/native-auth.ts).
   */
  const oauth = async (provider: "google" | "apple") => {
    setBusy(true);
    const failKey = provider === "google" ? "auth.googleFailed" : "auth.appleFailed";

    if (isNative()) {
      const result = await nativeOAuthSignIn(provider);
      setBusy(false);
      if (result.status === "cancelled") {
        toast.message(t("auth.cancelled"));
        return;
      }
      if (result.status === "error") {
        toast.error(t(failKey));
        return;
      }
      navigate({ to: "/home" });
      return;
    }

    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: `${window.location.origin}/auth/callback`,
    });
    if (result.error) {
      setBusy(false);
      toast.error(t(failKey));
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/home" });
  };


  return (
    <div className="flex min-h-svh items-center bg-background px-6">
      <div className="mx-auto w-full max-w-[400px] py-14">
        <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.03em]">
          {t("auth.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {hasPendingInvite ? t("auth.inviteContext") : t("auth.subtitle")}
        </p>

        <form onSubmit={submit} className="mt-10 space-y-3">
          {mode === "signup" ? (
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("profile.name")}
              autoComplete="name"
              className="h-14 w-full rounded-2xl bg-surface px-4 text-[15px] outline-none ring-accent/40 focus:ring-2"
            />
          ) : null}
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("auth.email")}
            autoComplete="email"
            className="h-14 w-full rounded-2xl bg-surface px-4 text-[15px] outline-none ring-accent/40 focus:ring-2"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t("auth.password")}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className="h-14 w-full rounded-2xl bg-surface px-4 text-[15px] outline-none ring-accent/40 focus:ring-2"
          />
          <PrimaryButton type="submit" disabled={busy}>
            {mode === "signup" ? t("auth.signUp") : t("auth.signIn")}
          </PrimaryButton>
        </form>

        <div className="mt-3">
          <SecondaryButton onClick={google} disabled={busy}>
            {t("auth.google")}
          </SecondaryButton>
        </div>

        {mode === "signin" ? (
          <button
            type="button"
            onClick={() => {
              setResetEmail(email);
              setResetOpen(true);
            }}
            className="mx-auto mt-6 block text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("auth.forgot")}
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mx-auto mt-6 block text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {mode === "signin" ? t("auth.toSignUp") : t("auth.toSignIn")}
        </button>
      </div>

      <BottomSheet
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title={t("auth.resetTitle")}
        description={t("auth.resetBody")}
      >
        <form onSubmit={sendReset} className="space-y-3 pb-2">
          <input
            type="email"
            required
            value={resetEmail}
            onChange={(event) => setResetEmail(event.target.value)}
            placeholder={t("auth.email")}
            autoComplete="email"
            className="h-14 w-full rounded-2xl bg-surface-strong px-4 text-[15px] outline-none ring-accent/40 focus:ring-2"
          />
          <PrimaryButton type="submit" disabled={resetBusy}>
            {t("auth.resetSend")}
          </PrimaryButton>
        </form>
      </BottomSheet>
    </div>
  );
}
