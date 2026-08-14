import { createFileRoute } from "@tanstack/react-router";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Divider, Panel, Screen } from "@/components/pari/AppShell";
import { FlowHeader } from "@/components/pari/FlowHeader";
import { Avatar } from "@/components/pari/Avatar";
import { MoneyAmount } from "@/components/pari/MoneyAmount";
import { EmptyState } from "@/components/pari/EmptyState";
import { usePari } from "@/data/store";
import { useT } from "@/lib/i18n";
import { formatMinor } from "@/lib/money";
import { AuthGate } from "@/components/pari/AuthGate";

export const Route = createFileRoute("/settle/$groupId")({
  head: () => ({
    meta: [
      { title: "Settle up — PARI" },
      {
        name: "description",
        content: "The shortest way to clear a group: fewest payments, exact amounts.",
      },
      { property: "og:title", content: "Settle up — PARI" },
      {
        property: "og:description",
        content: "The shortest way to clear a group: fewest payments, exact amounts.",
      },
    ],
  }),
  component: () => (
    <AuthGate>
      <SettleScreen />
    </AuthGate>
  ),
});

function SettleScreen() {
  const t = useT();
  const { groupId } = Route.useParams();
  const pari = usePari();
  const group = pari.data.groups.find((g) => g.id === groupId);
  const plan = pari.settlementPlan(groupId);

  return (
    <Screen>
      <FlowHeader title={t("settle.title")} subtitle={group?.name} />

      <div className="px-1 pb-8">
        <h1 className="text-[26px] font-semibold tracking-[-0.03em]">{t("settle.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("settle.hint")}
        </p>
      </div>

      {plan.length === 0 ? (
        <EmptyState
          title={t("settle.allSettled")}
          description={t("settle.nothingPending")}
        />
      ) : (
        <Panel>
          {plan.map((step, index) => (
            <div key={`${step.fromPersonId}-${step.toPersonId}`}>
              {index > 0 ? <Divider /> : null}
              <div className="space-y-4 px-4 py-4">
                <div className="flex items-center gap-3">
                  <Avatar name={pari.personName(step.fromPersonId)} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium tracking-tight">
                      {t("settle.pays", {
                        from: pari.personName(step.fromPersonId),
                        to: pari.personName(step.toPersonId),
                      })}
                    </p>
                    <MoneyAmount minor={step.amountMinor} tone="muted" size="sm" className="mt-1 block" />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(
                        formatMinor(step.amountMinor, { currency: "" }).trim(),
                      );
                      toast.success(t("settle.copied"));
                    }}
                    className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-surface-strong text-sm font-medium"
                  >
                    <Copy className="h-4 w-4" strokeWidth={1.6} />
                    {t("settle.copyAmount")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      pari.markSettled(groupId, step);
                      toast.success(t("settle.markedPaid"));
                    }}
                    className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-primary text-sm font-medium text-primary-foreground"
                  >
                    {t("settle.markPaid")}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </Panel>
      )}
    </Screen>
  );
}
