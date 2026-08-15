import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { Divider, Panel } from "@/components/pari/AppShell";
import { MoneyAmount } from "@/components/pari/MoneyAmount";
import { usePari } from "@/data/store";
import { useT } from "@/lib/i18n";
import { shortDate, timeOfDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Group-scoped presentation of the exact same settlement transactions the
 * Activity feed renders. Read-only: no balance or settlement logic here.
 */
export function GroupPayments({ groupId }: { groupId: string }) {
  const pari = usePari();
  const t = useT();
  const [openId, setOpenId] = useState<string | null>(null);

  const settlements = pari.data.settlements
    .filter((s) => s.group_id === groupId)
    .slice()
    .sort(
      (a, b) =>
        new Date(b.settled_at ?? b.created_at).getTime() -
        new Date(a.settled_at ?? a.created_at).getTime(),
    );

  if (settlements.length === 0) return null;

  /** Extra context (remaining / note) lives on the settlement activity entry. */
  const meta = (settlement: (typeof settlements)[number]) => {
    const entry = pari.data.activity.find(
      (a) =>
        a.activity_type === "settlement_marked" &&
        a.group_id === groupId &&
        a.metadata["from_person_id"] === settlement.from_person_id &&
        a.metadata["to_person_id"] === settlement.to_person_id &&
        a.metadata["amount_minor"] === settlement.amount_minor,
    );
    return {
      remaining:
        typeof entry?.metadata["remaining_minor"] === "number"
          ? (entry.metadata["remaining_minor"] as number)
          : 0,
      note: typeof entry?.metadata["note"] === "string" ? (entry.metadata["note"] as string) : "",
    };
  };

  return (
    <div className="space-y-3">
      <p className="px-1 text-[12px] uppercase tracking-wide text-muted-foreground/70">
        {t("groups.payments")}
      </p>
      <Panel>
        {settlements.map((settlement, index) => {
          const open = openId === settlement.id;
          const when = settlement.settled_at ?? settlement.created_at;
          const info = meta(settlement);
          return (
            <div key={settlement.id}>
              {index > 0 ? <Divider /> : null}
              <button
                type="button"
                onClick={() => setOpenId(open ? null : settlement.id)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-strong/60"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] tracking-tight">
                    {t("activity.settlementPaid", {
                      from: pari.personName(settlement.from_person_id),
                      to: pari.personName(settlement.to_person_id),
                    })}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {shortDate(when)} · {timeOfDay(when)}
                  </p>
                </div>
                <MoneyAmount minor={settlement.amount_minor} currency={settlement.currency} />
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform",
                    open && "rotate-180",
                  )}
                  strokeWidth={1.6}
                />
              </button>

              {open ? (
                <div className="animate-rise space-y-1.5 px-4 pb-5 text-[13px] text-muted-foreground">
                  <div className="flex justify-between">
                    <span>{t("activity.paymentFrom")}</span>
                    <span>{pari.personName(settlement.from_person_id)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("activity.paymentTo")}</span>
                    <span>{pari.personName(settlement.to_person_id)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("activity.paymentAmount")}</span>
                    <MoneyAmount
                      minor={settlement.amount_minor}
                      currency={settlement.currency}
                      tone="muted"
                    />
                  </div>
                  <div className="flex justify-between">
                    <span>{t("activity.paymentRemaining")}</span>
                    {info.remaining > 0 ? (
                      <MoneyAmount
                        minor={info.remaining}
                        currency={settlement.currency}
                        tone="muted"
                      />
                    ) : (
                      <span>{t("activity.paymentSettled")}</span>
                    )}
                  </div>
                  {info.note ? (
                    <div className="flex justify-between">
                      <span>{t("activity.paymentNote")}</span>
                      <span>{info.note}</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </Panel>
    </div>
  );
}
