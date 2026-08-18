import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PrimaryButton, SecondaryButton } from "@/components/pari/Buttons";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { authErrorKey, safeRedirectPath } from "@/lib/auth-errors";
import { useI18n, useT } from "@/lib/i18n";

type Search = { mode?: "signup"; redirect?: string };

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): Search => {
    const next: Search = {};
    if (search["mode"] === "signup") next.mode = "signup";
    const redirect = safeRedirectPath(
      typeof search["redirect"] === "string" ? search["redirect"] : null,
    );
    if (redirect) next.redirect = redirect;
    return next;
  },

  head: () => ({
    meta: [
      { title: "Sign in — PARI" },
      { name: "description", content: "Sign in to PARI to split and settle shared expenses." },
      { property: "og:title", content: "Sign in — PARI" },
      {
        property: "og:description",
        content: "Sign in to PARI to split and settle shared expenses.",
      },
    ],
  }),
  component: AuthScreen,
});

function AuthScreen() {
  const t = useT();
  const { language } = useI18n();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(
    search.mode === "signup" ? "signup" : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  // Where to land after authentication — always a validated same-origin path.
  const destination = safeRedirectPath(search.redirect ?? null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;
      if (destination) window.location.replace(destination);
      else navigate({ to: "/home" });
    });
  }, [navigate, destination]);

  const done = () => {
    if (destination) window.location.replace(destination);
    else navigate({ to: "/home" });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset`,
        });
        if (error) throw error;
        setSent(true);
        toast.success(t("auth.resetSent"));
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // Verification returns the user to exactly where they started —
            // an invitation link survives sign-up this way.
            emailRedirectTo: `${window.location.origin}${destination ?? "/home"}`,
            data: { display_name: name.trim() || email.split("@")[0], locale: language },
          },
        });
        if (error) throw error;
        const { data: session } = await supabase.auth.getSession();
        if (session.session) done();
        else toast.success(t("auth.checkEmail"));
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        done();
      }
    } catch (error) {
      toast.error(t(authErrorKey(error)));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error(t("auth.googleFailed"));
      return;
    }
    if (result.redirected) return;
    done();
  };

  return (
    <div className="flex min-h-svh items-center bg-background px-6">
      <div className="mx-auto w-full max-w-[400px] py-14">
        <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.03em]">
          {mode === "forgot" ? t("auth.resetTitle") : t("auth.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "forgot" ? t("auth.resetSubtitle") : t("auth.subtitle")}
        </p>
        {destination ? (
          <p className="mt-2 text-sm text-muted-foreground">{t("invite.kept")}</p>
        ) : null}

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
          {mode === "forgot" ? null : (
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
          )}
          <PrimaryButton type="submit" disabled={busy}>
            {mode === "forgot"
              ? t("auth.resetSend")
              : mode === "signup"
                ? t("auth.signUp")
                : t("auth.signIn")}
          </PrimaryButton>
        </form>

        {mode === "forgot" && sent ? (
          <p className="mt-4 text-center text-sm text-muted-foreground">{t("auth.resetSent")}</p>
        ) : null}

        {mode === "forgot" ? null : (
          <div className="mt-3">
            <SecondaryButton onClick={google} disabled={busy}>
              {t("auth.google")}
            </SecondaryButton>
          </div>
        )}

        {mode === "signin" ? (
          <button
            type="button"
            onClick={() => {
              setSent(false);
              setMode("forgot");
            }}
            className="mx-auto mt-6 block text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("auth.forgot")}
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setSent(false);
            setMode(mode === "signin" ? "signup" : "signin");
          }}
          className="mx-auto mt-6 block text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {mode === "forgot"
            ? t("auth.backToSignIn")
            : mode === "signin"
              ? t("auth.toSignUp")
              : t("auth.toSignIn")}
        </button>
      </div>
    </div>
  );
}
