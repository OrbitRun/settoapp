import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, ScanLine } from "lucide-react";

import { Screen } from "@/components/pari/AppShell";
import { FlowHeader } from "@/components/pari/FlowHeader";
import { emptyDraft } from "@/data/draft";
import { usePari } from "@/data/store";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/split/start")({
  head: () => ({
    meta: [
      { title: "Split an expense — Setto" },
      {
        name: "description",
        content: "Scan a receipt or enter an amount — Setto splits it in seconds.",
      },
      { property: "og:title", content: "Split an expense — Setto" },
      {
        property: "og:description",
        content: "Scan a receipt or enter an amount — Setto splits it in seconds.",
      },
    ],
  }),
  component: SplitStartScreen,
});

function SplitStartScreen() {
  const pari = usePari();
  const t = useT();
  const navigate = useNavigate();

  const start = (target: "/split/amount" | "/split/scan") => {
    pari.setDraft({
      ...emptyDraft(pari.currentPersonId),
      source: target === "/split/scan" ? "receipt" : "manual",
    });
    navigate({ to: target });
  };

  return (
    <Screen className="pb-16">
      <FlowHeader
        title={t("start.title")}
        variant="close"
        onClose={() => navigate({ to: pari.isGuest ? "/" : "/home" })}
      />

      <div className="animate-rise space-y-3 pt-4">
        <h1 className="px-1 pb-3 text-[26px] font-semibold tracking-[-0.03em]">
          {t("start.heading")}
        </h1>

        <button
          type="button"
          onClick={() => start("/split/scan")}
          className="flex w-full items-center gap-4 rounded-3xl bg-surface px-5 py-6 text-left shadow-soft transition-transform active:scale-[0.99]"
        >
          <ScanLine className="h-6 w-6 shrink-0" strokeWidth={1.6} />
          <span className="min-w-0">
            <span className="block text-[17px] font-medium tracking-tight">{t("start.scan")}</span>
            <span className="mt-0.5 block text-sm text-muted-foreground">
              {t("start.scanHint")}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => start("/split/amount")}
          className="flex w-full items-center gap-4 rounded-3xl bg-surface px-5 py-6 text-left shadow-soft transition-transform active:scale-[0.99]"
        >
          <Plus className="h-6 w-6 shrink-0" strokeWidth={1.6} />
          <span className="min-w-0">
            <span className="block text-[17px] font-medium tracking-tight">
              {t("start.manual")}
            </span>
            <span className="mt-0.5 block text-sm text-muted-foreground">
              {t("start.manualHint")}
            </span>
          </span>
        </button>
      </div>
    </Screen>
  );
}
