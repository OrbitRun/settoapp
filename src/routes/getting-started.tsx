import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { PrimaryButton, QuietButton } from "@/components/pari/Buttons";
import { Wordmark } from "@/components/pari/Wordmark";
import { readPendingInvite } from "@/data/invitations";
import { supabase } from "@/integrations/supabase/client";
import { markFirstRunDone } from "@/lib/first-run";
import { useT } from "@/lib/i18n";

/**
 * One compact first-run screen shown once, right after a Setto account is
 * created. Both actions mark it complete; a pending invitation always takes
 * precedence over Home afterwards.
 */
export const Route = createFileRoute("/getting-started")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Getting started — Setto" },
      { name: "description", content: "The three steps behind Setto: group, expense, settle." },
      { property: "og:title", content: "Getting started — Setto" },
      {
        property: "og:description",
        content: "The three steps behind Setto: group, expense, settle.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GettingStartedScreen,
});

const STEPS = [
  { titleKey: "firstRun.step1Title", bodyKey: "firstRun.step1Body" },
  { titleKey: "firstRun.step2Title", bodyKey: "firstRun.step2Body" },
  { titleKey: "firstRun.step3Title", bodyKey: "firstRun.step3Body" },
] as const;

function GettingStartedScreen() {
  const t = useT();
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const id = data.session?.user.id ?? null;
      if (!id) {
        void navigate({ to: "/auth", replace: true });
        return;
      }
      setUserId(id);
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  const finish = () => {
    if (userId) markFirstRunDone(userId);
    const pending = readPendingInvite();
    void navigate(
      pending
        ? { to: "/invite/$token", params: { token: pending }, replace: true }
        : { to: "/home", replace: true },
    );
  };

  return (
    <div className="min-h-svh bg-background">
      <main className="mx-auto flex min-h-svh w-full max-w-[430px] flex-col px-7 pb-10 pt-[max(3rem,env(safe-area-inset-top))]">
        <Wordmark className="h-5 opacity-80" />

        <h1 className="mt-8 text-[30px] font-semibold leading-[1.12] tracking-[-0.03em]">
          {t("firstRun.title")}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          {t("firstRun.intro")}
        </p>

        <ol className="mt-9 space-y-3">
          {STEPS.map((step, index) => (
            <li key={step.titleKey} className="flex gap-4 rounded-2xl bg-surface px-4 py-4">
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[13px] font-semibold text-foreground"
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <h2 className="text-[16px] font-medium leading-snug">{t(step.titleKey)}</h2>
                <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
                  {t(step.bodyKey)}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-auto pt-10">
          <PrimaryButton onClick={finish}>{t("firstRun.cta")}</PrimaryButton>
          <QuietButton onClick={finish} className="mx-auto mt-2 flex h-11">
            {t("firstRun.skip")}
          </QuietButton>
        </div>
      </main>
    </div>
  );
}
