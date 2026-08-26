import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { BottomNav, Divider, Panel, Screen, TopBar } from "@/components/pari/AppShell";
import { EmptyState } from "@/components/pari/EmptyState";
import { Avatar } from "@/components/pari/Avatar";
import { MoneyAmount } from "@/components/pari/MoneyAmount";
import { ExpenseActivityCard } from "@/components/pari/ExpenseActivityCard";

import { usePari } from "@/data/store";
import { dayGroupLabel, shortDate } from "@/lib/dates";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ActivityEntry } from "@/data/types";
import { AuthGate } from "@/components/pari/AuthGate";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity — Setto" },
      {
        name: "description",
        content: "A calm, transparent log of every expense, change and settlement.",
      },
      { property: "og:title", content: "Activity — Setto" },
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

/** History lines describe what happened to the expense, never who is in the feed. */
const HISTORY_KEYS: Record<ActivityEntry["activity_type"], string> = {
  expense_added: "activity.historyCreated",
  expense_updated: "activity.historyEdited",
  expense_deleted: "activity.historyDeleted",
  split_changed: "activity.historySplit",
  settlement_marked: "activity.historyEdited",
  group_created: "activity.historyCreated",
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
                  const title = entry.metadata["title"] ? String(entry.metadata["title"]) : "";
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
                  const history =
                    entry.entity_type === "expense" && entry.entity_id
                      ? pari.expenseHistory(entry.entity_id)
                      : [];
                  const isDeleted = history.some((h) => h.activity_type === "expense_deleted");
                  const wasEdited = history.some(
                    (h) =>
                      h.activity_type === "expense_updated" || h.activity_type === "split_changed",
                  );
                  const originalCurrency =
                    expense?.original_currency ?? expense?.currency ?? undefined;
                  const foreign = expense != null && originalCurrency !== expense.currency;
                  const rowAmount = expense
                    ? (expense.original_total_minor ?? expense.total_minor)
                    : amount;
                  const settlement =
                    entry.activity_type === "settlement_marked" &&
                    typeof entry.metadata["from_person_id"] === "string" &&
                    typeof entry.metadata["to_person_id"] === "string"
                      ? {
                          from: pari.personName(String(entry.metadata["from_person_id"])),
                          to: pari.personName(String(entry.metadata["to_person_id"])),
                          remaining:
                            typeof entry.metadata["remaining_minor"] === "number"
                              ? entry.metadata["remaining_minor"]
                              : 0,
                          note:
                            typeof entry.metadata["note"] === "string"
                              ? entry.metadata["note"]
                              : "",
                        }
                      : null;


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
                            {settlement
                              ? t("activity.settlementPaid", {
                                  from: settlement.from,
                                  to: settlement.to,
                                })
                              : t(KEYS[entry.activity_type], { actor, title })}
                          </p>
                          <p className="mt-0.5 text-[13px] text-muted-foreground">
                            {shortDate(entry.created_at)}
                            {group ? ` · ${group.name}` : ""}
                            {isDeleted
                              ? ` · ${t("activity.deletedTag")}`
                              : wasEdited
                                ? ` · ${t("activity.edited")}`
                                : ""}
                          </p>
                        </div>
                        {rowAmount !== undefined ? (
                          <MoneyAmount
                            minor={rowAmount}
                            currency={expense ? originalCurrency : undefined}
                            tone="muted"
                          />
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
                            <ExpenseActivityCard expense={expense} history={history} />
                          ) : settlement ? (
                            <div className="space-y-1.5">
                              <p className="text-foreground">{t("activity.payment")}</p>
                              <div className="flex justify-between">
                                <span>{t("activity.paymentFrom")}</span>
                                <span>{settlement.from}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>{t("activity.paymentTo")}</span>
                                <span>{settlement.to}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>{t("activity.paymentAmount")}</span>
                                {amount !== undefined ? (
                                  <MoneyAmount minor={amount} tone="muted" />
                                ) : null}
                              </div>
                              <div className="flex justify-between">
                                <span>{t("activity.paymentRemaining")}</span>
                                {settlement.remaining > 0 ? (
                                  <MoneyAmount minor={settlement.remaining} tone="muted" />
                                ) : (
                                  <span>{t("activity.paymentSettled")}</span>
                                )}
                              </div>
                              {settlement.note ? (
                                <div className="flex justify-between">
                                  <span>{t("activity.paymentNote")}</span>
                                  <span>{settlement.note}</span>
                                </div>
                              ) : null}
                            </div>
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
