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
  const [openEvents, setOpenEvents] = useState<Record<string, boolean>>({});

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
            const expandable = lines.length > 0;
            const expanded = Boolean(openEvents[event.id]);

            const header = (
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-1.5 text-[15px]">
                  {t(HEADER_KEYS[event.activity_type], { actor })}
                  {expandable ? (
                    <ChevronRight
                      className={cn(
                        "h-3.5 w-3.5 text-muted-foreground transition-transform",
                        expanded && "rotate-90",
                      )}
                      strokeWidth={1.6}
                    />
                  ) : null}
                </span>
                <span className="shrink-0 text-[13px] text-muted-foreground">
                  {shortDate(event.created_at)} · {timeOfDay(event.created_at)}
                </span>
              </div>
            );

            return (
              <div key={event.id}>
                <Divider />
                <div className="px-4 py-4">
                  {expandable ? (
                    <button
                      type="button"
                      onClick={() =>
                        setOpenEvents((prev) => ({ ...prev, [event.id]: !prev[event.id] }))
                      }
                      className="w-full text-left"
                    >
                      {header}
                    </button>
                  ) : (
                    header
                  )}

                  {expandable && expanded ? (
                    <div className="animate-rise mt-3 space-y-3">
                      {lines.map((line) => (
                        <div key={line.key} className="space-y-1">
                          <p className="text-[12px] uppercase tracking-wide text-muted-foreground">
                            {line.label}
                          </p>
                          {line.details.map((detail, index) => (
                            <div
                              key={`${line.key}-${index}`}
                              className="flex items-baseline justify-between gap-3 text-[13px]"
                            >
                              {detail.name ? (
                                <span className="text-muted-foreground">{detail.name}</span>
                              ) : null}
                              <span
                                className={cn(
                                  "text-foreground",
                                  detail.name ? "text-right" : "flex-1",
                                )}
                              >
                                {detail.value}
                              </span>
                            </div>
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
