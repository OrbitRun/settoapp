import { useState } from "react";
import { ChevronRight } from "lucide-react";

import { Divider, Panel } from "@/components/pari/AppShell";
import { usePari } from "@/data/store";
import { shortDate, timeOfDay } from "@/lib/dates";
import { describeChanges, type ExpenseChangeSet } from "@/lib/history";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ActivityEntry } from "@/data/types";

const HEADER_KEYS: Record<ActivityEntry["activity_type"], string> = {
  expense_added: "activity.historyCreated",
  expense_updated: "activity.historyEdited",
  expense_deleted: "activity.historyDeleted",
  split_changed: "activity.historySplit",
  settlement_marked: "activity.historyEdited",
  group_created: "activity.historyCreated",
};

/** Compact, collapsed-by-default change history for one expense. */
export function ExpenseHistory({ expenseId }: { expenseId: string }) {
  const pari = usePari();
  const t = useT();
  const [open, setOpen] = useState(false);

  // Newest first for quick inspection; creation stays at the bottom.
  const events = [...pari.expenseHistory(expenseId)].reverse();
  if (events.length === 0) return null;

  const groupName = (id: string) =>
    pari.data.groups.find((group) => group.id === id)?.name ?? t("history.noGroup");

  return (
    <Panel>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-4 text-left"
      >
        <span className="text-[15px]">{t("activity.history")}</span>
        <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
          {events.length === 1
            ? t("history.eventsOne")
            : t("history.events", { count: events.length })}
          <ChevronRight
            className={cn("h-4 w-4 transition-transform", open && "rotate-90")}
            strokeWidth={1.6}
          />
        </span>
      </button>

      {open ? (
        <div className="animate-rise">
          {events.map((event) => {
            const actor = event.actor_person_id
              ? pari.personName(event.actor_person_id)
              : pari.currentProfileName;
            const raw = event.metadata["changes"] as ExpenseChangeSet | undefined;
            const lines = raw
              ? describeChanges(raw, { t, personName: pari.personName, groupName })
              : [];
            return (
              <div key={event.id}>
                <Divider />
                <div className="space-y-2 px-4 py-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[15px]">
                      {t(HEADER_KEYS[event.activity_type], { actor })}
                    </span>
                    <span className="shrink-0 text-[13px] text-muted-foreground">
                      {shortDate(event.created_at)} · {timeOfDay(event.created_at)}
                    </span>
                  </div>
                  {lines.length > 0 ? (
                    <div className="space-y-2">
                      {lines.map((line) => (
                        <div key={line.label} className="text-[13px]">
                          <p className="text-muted-foreground">{line.label}</p>
                          {line.details.map((detail) => (
                            <p key={detail} className="text-foreground">
                              {detail}
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </Panel>
  );
}
