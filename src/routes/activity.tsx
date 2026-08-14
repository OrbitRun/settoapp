import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { BottomNav, Divider, Panel, Screen, TopBar } from "@/components/pari/AppShell";
import { EmptyState } from "@/components/pari/EmptyState";
import { Avatar } from "@/components/pari/Avatar";
import { MoneyAmount } from "@/components/pari/MoneyAmount";
import { usePari } from "@/data/store";
import { dayGroupLabel, shortDate } from "@/lib/dates";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ActivityEntry } from "@/data/types";
import { AuthGate } from "@/components/pari/AuthGate";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity — PARI" },
      {
        name: "description",
        content: "A calm, transparent log of every expense, change and settlement.",
      },
      { property: "og:title", content: "Activity — PARI" },
      {
        property: "og:description",
        content: "A calm, transparent log of every expense, change and settlement.",
      },
    ],
  }),
  component: () => (
    <AuthGate>
      <ActivityScreen />
    </AuthGate>
  ),
});

const KEYS: Record<ActivityEntry["activity_type"], string> = {
  expense_added: "activity.expenseAdded",
  expense_updated: "activity.expenseUpdated",
  expense_deleted: "activity.expenseDeleted",
  split_changed: "activity.splitChanged",
  settlement_marked: "activity.settlementMarked",
  group_created: "activity.groupCreated",
};

function ActivityScreen() {
  const pari = usePari();
  const t = useT();
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<string | null>(null);
  const feed = pari.activityFeed();

  const days = feed.reduce<Record<string, ActivityEntry[]>>((acc, entry) => {
    const key = dayGroupLabel(entry.created_at);
    (acc[key] ??= []).push(entry);
    return acc;
  }, {});

  return (
    <>
      <Screen>
        <TopBar title={t("activity.title")} />

        {feed.length === 0 ? (
          <EmptyState title={t("activity.empty")} description={t("activity.emptyHint")} />
        ) : (
          <div className="space-y-8">
            {Object.entries(days).map(([day, entries]) => (
              <Panel key={day} title={day}>
                {entries.map((entry, index) => {
                  const actor = entry.actor_person_id
                    ? pari.personName(entry.actor_person_id)
                    : pari.currentProfileName;
                  const title = entry.metadata["title"]
                    ? String(entry.metadata["title"])
                    : "";
                  const amount =
                    typeof entry.metadata["amount_minor"] === "number"
                      ? entry.metadata["amount_minor"]
                      : undefined;
                  const group = entry.group_id
                    ? pari.data.groups.find((g) => g.id === entry.group_id)
                    : undefined;
                  const expense =
                    entry.entity_type === "expense" && entry.entity_id
                      ? pari.expenseById(entry.entity_id)
                      : undefined;
                  const open = openId === entry.id;

                  return (
                    <div key={entry.id}>
                      {index > 0 ? <Divider /> : null}
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : entry.id)}
                        className="flex w-full items-center gap-3 px-4 py-4 text-left"
                      >
                        <Avatar name={actor} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px]">
                            {t(KEYS[entry.activity_type], { actor, title })}
                          </p>
                          <p className="mt-0.5 text-[13px] text-muted-foreground">
                            {shortDate(entry.created_at)}
                            {group ? ` · ${group.name}` : ""}
                          </p>
                        </div>
                        {amount !== undefined ? (
                          <MoneyAmount minor={amount} tone="muted" />
                        ) : null}
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform",
                            open && "rotate-180",
                          )}
                          strokeWidth={1.6}
                        />
                      </button>

                      {open ? (
                        <div className="animate-rise space-y-2 px-4 pb-5 text-[13px] text-muted-foreground">
                          {expense ? (
                            <>
                              <div className="flex justify-between">
                                <span className="text-foreground">{expense.title}</span>
                                <MoneyAmount minor={expense.total_minor} />
                              </div>
                              {group ? (
                                <div className="flex justify-between">
                                  <span>{t("expense.group")}</span>
                                  <span>{group.name}</span>
                                </div>
                              ) : null}
                              <div className="flex justify-between">
                                <span>{t("split.paidBy")}</span>
                                <span>{pari.personName(expense.paid_by_person_id)}</span>
                              </div>
                              <div className="pt-1">
                                {pari.expenseAllocations(expense.id).map((allocation) => (
                                  <div
                                    key={allocation.personId}
                                    className="flex justify-between py-0.5"
                                  >
                                    <span>
                                      {pari.personName(allocation.personId)}
                                      {allocation.percentage != null
                                        ? ` · ${allocation.percentage}%`
                                        : allocation.shares != null
                                          ? ` · ${allocation.shares}`
                                          : ""}
                                    </span>
                                    <MoneyAmount minor={allocation.amountMinor} tone="muted" />
                                  </div>
                                ))}
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  navigate({
                                    to: "/expense/$expenseId",
                                    params: { expenseId: expense.id },
                                  })
                                }
                                className="pt-2 text-[13px] font-medium text-foreground"
                              >
                                {t("expense.title")} →
                              </button>
                            </>
                          ) : (
                            <div className="flex justify-between">
                              <span>{group ? group.name : t("activity.title")}</span>
                              {amount !== undefined ? (
                                <MoneyAmount minor={amount} tone="muted" />
                              ) : null}
                            </div>
                          )}
                        </div>
                      ) : null}

                    </div>
                  );
                })}
              </Panel>
            ))}
          </div>
        )}
      </Screen>
      <BottomNav />
    </>
  );
}
