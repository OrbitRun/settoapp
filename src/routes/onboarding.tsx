import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { PrimaryButton } from "@/components/pari/Buttons";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { Wordmark } from "@/components/pari/Wordmark";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Welcome to Setto" },
      {
        name: "description",
        content: "Share anything. Split it your way. Settle easily.",
      },
      { property: "og:title", content: "Welcome to Setto" },
      { property: "og:description", content: "Share anything. Split it your way. Settle easily." },
    ],
  }),
  component: OnboardingScreen,
});

const STEPS = [
  { titleKey: "onboarding.shareTitle", bodyKey: "onboarding.shareBody" },
  { titleKey: "onboarding.splitTitle", bodyKey: "onboarding.splitBody" },
  { titleKey: "onboarding.settleTitle", bodyKey: "onboarding.settleBody" },
] as const;

function OnboardingScreen() {
  const t = useT();
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const current = STEPS[step]!;
  const last = step === STEPS.length - 1;

  return (
    <div className="min-h-svh bg-background">
      <div className="mx-auto flex min-h-svh w-full max-w-[430px] flex-col px-7 pb-12 pt-[calc(env(safe-area-inset-top)+4rem)]">
        <div key={step} className="animate-rise flex flex-1 flex-col justify-center">
          <Wordmark className="h-6" />
          <h1 className="mt-4 text-[38px] font-semibold leading-[1.08] tracking-[-0.035em]">
            {t(current.titleKey)}
          </h1>
          <p className="mt-4 max-w-[28ch] text-[17px] text-muted-foreground">
            {t(current.bodyKey)}
          </p>
        </div>

        <div className="mb-8 flex gap-1.5">
          {STEPS.map((item, index) => (
            <span
              key={item.titleKey}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors duration-300",
                index <= step ? "bg-primary" : "bg-hairline",
              )}
            />
          ))}
        </div>

        <PrimaryButton
          onClick={() => (last ? navigate({ to: "/home" }) : setStep((prev) => prev + 1))}
        >
          {last ? t("onboarding.getStarted") : t("common.continue")}
        </PrimaryButton>
      </div>
    </div>
  );
}
