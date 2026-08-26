import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { usePari } from "@/data/store";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Setto — Share anything. Settle easily." },
      {
        name: "description",
        content:
          "Split a bill in seconds — scan a receipt or enter an amount. No account needed to try Setto.",
      },
      { property: "og:title", content: "Setto — Share anything. Settle easily." },
      {
        property: "og:description",
        content: "The calm way to split shared expenses with the people around you.",
      },
    ],
  }),
  component: WelcomeScreen,
});

/**
 * The canonical unauthenticated root of Setto. Signed-in users are forwarded to
 * their authenticated home; guests stay here with no app shell around them.
 */
function WelcomeScreen() {
  const t = useT();
  const { authReady, isGuest } = usePari();
  const navigate = useNavigate();

  useEffect(() => {
    if (authReady && !isGuest) navigate({ to: "/home", replace: true });
  }, [authReady, isGuest, navigate]);

  return (
    <div className="min-h-svh bg-background">
      <div className="mx-auto flex min-h-svh w-full max-w-[430px] flex-col px-7 pb-[max(env(safe-area-inset-bottom),2rem)] pt-16">
        <div className="animate-rise flex flex-1 flex-col justify-center">
          <p className="text-sm text-muted-foreground">Setto</p>
          <h1 className="mt-4 whitespace-pre-line text-[38px] font-semibold leading-[1.08] tracking-[-0.035em]">
            {t("welcome.title")}
          </h1>
          <p className="mt-4 max-w-[28ch] text-[17px] text-muted-foreground">
            {t("welcome.subtitle")}
          </p>
        </div>
        <div className="space-y-3">
          <Link
            to="/split/start"
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-primary text-[15px] font-medium text-primary-foreground"
          >
            {t("welcome.primary")}
          </Link>
          <Link
            to="/auth"
            search={{}}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-surface-strong text-[15px] font-medium"
          >
            {t("welcome.secondary")}
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="mx-auto block py-3 text-center text-sm text-muted-foreground"
          >
            {t("welcome.createAccount")}
          </Link>
          <p className="text-center text-xs text-muted-foreground">{t("welcome.note")}</p>
        </div>
      </div>
    </div>
  );
}
