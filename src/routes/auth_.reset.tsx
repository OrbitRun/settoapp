import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PrimaryButton, SecondaryButton } from "@/components/pari/Buttons";
import { EmptyState } from "@/components/pari/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { authErrorKey } from "@/lib/auth-errors";
import { useT } from "@/lib/i18n";

/**
 * Password reset landing page. The recovery link comes from the auth provider
 * — this screen only exchanges it for a session and sets the new password.
 * Expired, reused and malformed links all resolve to the same calm state.
 */
export const Route = createFileRoute("/auth_/reset")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Choose a new password — PARI" },
      { name: "description", content: "Set a new password for your PARI account." },
      { property: "og:title", content: "Choose a new password — PARI" },
      { property: "og:description", content: "Set a new password for your PARI account." },
    ],
  }),
  component: ResetScreen,
});

function ResetScreen() {
  const t = useT();
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "ready" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    const resolve = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) {
        setState("ready");
        return;
      }
      // PKCE style link: ?code=...
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!active) return;
        setState(error ? "invalid" : "ready");
        return;
      }
      setState("invalid");
    };

    // The implicit flow delivers the recovery session asynchronously.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
        setState("ready");
      }
    });

    void resolve();
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== repeat) {
      toast.error(t("auth.mismatch"));
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success(t("auth.passwordChanged"));
      navigate({ to: "/home" });
    } catch (error) {
      toast.error(t(authErrorKey(error)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center bg-background px-6">
      <div className="mx-auto w-full max-w-[400px] py-14">
        {state === "checking" ? (
          <p className="text-sm text-muted-foreground">{t("auth.checking")}</p>
        ) : state === "invalid" ? (
          <div>
            <EmptyState title={t("auth.linkInvalidTitle")} description={t("auth.linkInvalidBody")} />
            <div className="mt-6">
              <SecondaryButton onClick={() => navigate({ to: "/auth", search: {} })}>
                {t("auth.backToSignIn")}
              </SecondaryButton>
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.03em]">
              {t("auth.resetTitle")}
            </h1>
            <form onSubmit={save} className="mt-10 space-y-3">
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
                value={repeat}
                onChange={(event) => setRepeat(event.target.value)}
                placeholder={t("auth.repeatPassword")}
                autoComplete="new-password"
                className="h-14 w-full rounded-2xl bg-surface px-4 text-[15px] outline-none ring-accent/40 focus:ring-2"
              />
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
