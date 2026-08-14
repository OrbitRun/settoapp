import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { PrimaryButton } from "@/components/pari/Buttons";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Welcome to PARI" },
      {
        name: "description",
        content: "Share anything. Split it your way. Settle easily.",
      },
      { property: "og:title", content: "Welcome to PARI" },
      { property: "og:description", content: "Share anything. Split it your way. Settle easily." },
    ],
  }),
  component: OnboardingScreen,
});

const STEPS = [
  {
    title: "Share anything.",
    body: "Dinner, rent, groceries or a weekend away.",
  },
  {
    title: "Split it your way.",
    body: "Equal, 60/40 or down to individual items.",
  },
  {
    title: "Settle easily.",
    body: "PARI keeps track of who owes what.",
  },
];

function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const current = STEPS[step]!;
  const last = step === STEPS.length - 1;

  return (
    <div className="min-h-svh bg-background">
      <div className="mx-auto flex min-h-svh w-full max-w-[430px] flex-col px-7 pb-12 pt-16">
        <div key={step} className="animate-rise flex flex-1 flex-col justify-center">
          <p className="text-sm text-muted-foreground">PARI</p>
          <h1 className="mt-4 text-[38px] font-semibold leading-[1.08] tracking-[-0.035em]">
            {current.title}
          </h1>
          <p className="mt-4 max-w-[28ch] text-[17px] text-muted-foreground">{current.body}</p>
        </div>

        <div className="mb-8 flex gap-1.5">
          {STEPS.map((item, index) => (
            <span
              key={item.title}
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
          {last ? "Get started" : "Continue"}
        </PrimaryButton>
      </div>
    </div>
  );
}
