import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, ChevronDown, Plus, UserPlus } from "lucide-react";

import { BottomNav, Divider, Panel, Screen } from "@/components/pari/AppShell";
import { FlowHeader } from "@/components/pari/FlowHeader";
import { Avatar } from "@/components/pari/Avatar";
import { BalanceDisplay, MoneyAmount, balanceTone } from "@/components/pari/MoneyAmount";
import { EmptyState } from "@/components/pari/EmptyState";
import { ExpenseActivityCard } from "@/components/pari/ExpenseActivityCard";
import { emptyDraft } from "@/data/draft";
import { usePari } from "@/data/store";
import { useT } from "@/lib/i18n";
import { shortDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { AuthGate } from "@/components/pari/AuthGate";
import { InviteSheet } from "@/components/pari/InviteSheet";

export const Route = createFileRoute("/groups/$groupId")({
  head: () => ({
    meta: [
      { title: "Group — PARI" },
      { name: "description", content: "Your balance, the expenses and who shares what." },
      { property: "og:title", content: "Group — PARI" },
      {
        property: "og:description",
        content: "Your balance, the expenses and who shares what.",
      },
    ],
  }),
  component: () => (
    <AuthGate>
      <GroupDetailScreen />
    </AuthGate>
  ),
});

const TABS = [
  { value: "Expenses", labelKey: "groups.expenses" },
  { value: "People", labelKey: "groups.people" },
  { value: "Rules", labelKey: "groups.rules" },
] as const;

function GroupDetailScreen() {
  const { groupId } = Route.useParams();
  const pari = usePari();
  const navigate = useNavigate();
  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("Expenses");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [openExpenseId, setOpenExpenseId] = useState<string | null>(null);
  const t = useT();

  const group = pari.data.groups.find((g) => g.id === groupId);
  if (!group) {
    return (
      <Screen>
        <FlowHeader title={t("groups.title")} />
        <EmptyState title={t("groups.gone")} />
      </Screen>
    );
  }

  const memberIds = pari.groupPersonIds(groupId);
  const expenses = pari.groupExpenses(groupId);
  const balances = pari.groupBalances(groupId);
  const myBalance = pari.myGroupBalance(groupId);
  const defaults = pari.groupDefaultPercentages(groupId);
  // "Gør op" is a real action only when someone actually owes someone else.
  const canSettle = pari.settlementPlan(groupId).length > 0;

  const addExpense = () => {
    pari.setDraft({
      ...emptyDraft(pari.currentPersonId),
      groupId,
      participants: memberIds,
      mode: defaults ? "percentage" : "equal",
      percentages: defaults ?? {},
      usingGroupDefault: Boolean(defaults),
    });
    navigate({ to: "/split/amount" });
  };

  return (
    <>
      <Screen>
        <FlowHeader
          title={group.name}
          subtitle={t("common.memberCount", { count: memberIds.length })}
        />

        <div className="animate-rise px-1 pb-8">
          <BalanceDisplay
            minor={myBalance}
            label={t("groups.yourBalance")}
            hint={
              myBalance > 0
                ? t("groups.shouldReceive")
                : myBalance < 0
                  ? t("groups.shouldPay")
                  : t("settle.allSettled")
            }
          />
        </div>

        <div className="mb-6 flex gap-1 rounded-2xl bg-surface-strong p-1">
          {TABS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setTab(option.value)}
              className={cn(
                "flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors",
                tab === option.value
                  ? "bg-surface text-foreground shadow-soft"
                  : "text-muted-foreground",
              )}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>

        {tab === "Expenses" ? (
          <div className="space-y-6">
            <Panel>
              {expenses.length === 0 ? (
                <EmptyState
                  title={t("groups.noExpenses")}
                  description={t("groups.noExpensesHint")}
                />
              ) : (
                expenses.map((expense, index) => {
                  const open = openExpenseId === expense.id;
                  const foreign =
                    expense.original_currency != null &&
                    expense.original_total_minor != null &&
                    expense.original_currency !== expense.currency;
                  const displayMinor = expense.original_total_minor ?? expense.total_minor;
                  const displayCurrency = foreign ? expense.original_currency! : expense.currency;
                  return (
                    <div key={expense.id}>
                      {index > 0 ? <Divider /> : null}
                      <button
                        type="button"
                        onClick={() => setOpenExpenseId(open ? null : expense.id)}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-strong/60"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-medium tracking-tight">
                            {expense.title}
                          </p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {shortDate(expense.expense_date)} ·{" "}
                            {t("home.paidBy", {
                              name: pari.personName(expense.paid_by_person_id),
                            })}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <MoneyAmount minor={displayMinor} currency={displayCurrency} />
                        </div>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform",
                            open && "rotate-180",
                          )}
                          strokeWidth={1.6}
                        />
                      </button>

                      {open ? (
                        <div className="animate-rise px-4 pb-5">
                          <ExpenseActivityCard
                            expense={expense}
                            showHeader={false}
                            showGroup={false}
                            showHistory={false}
                          />
                        </div>
                      ) : null}

                    </div>
                  );
                })
              )}
            </Panel>

            <GroupPayments groupId={groupId} />



            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={addExpense}
                className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-[15px] font-medium text-primary-foreground transition-transform active:scale-[0.99]"
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
                {t("groups.addExpense")}
              </button>

              {canSettle ? (
                <Link
                  to="/settle/$groupId"
                  params={{ groupId }}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-accent/50 bg-accent/15 py-4 text-[15px] font-medium text-foreground transition-transform active:scale-[0.99]"
                >
                  <Check className="h-4 w-4" strokeWidth={2} />
                  {t("groups.settleUp")}
                </Link>
              ) : (
                <div className="flex items-center justify-center gap-2 rounded-2xl bg-surface-strong/60 py-4 text-[15px] font-medium text-muted-foreground">
                  <Check className="h-4 w-4" strokeWidth={2} />
                  {t("groups.nothingToSettle")}
                </div>
              )}

              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                className="flex items-center justify-center gap-2 rounded-2xl bg-surface-strong py-4 text-[15px] font-medium transition-transform active:scale-[0.99]"
              >
                <UserPlus className="h-4 w-4" strokeWidth={2} />
                {t("invite.title")}
              </button>
              <Link
                to="/groups/$groupId/edit"
                params={{ groupId }}
                className="pb-2 pt-1 text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("groups.edit")}
              </Link>
            </div>
          </div>
        ) : null}

        {tab === "People" ? (
          <Panel>
            {balances.map((balance, index) => (
              <div key={balance.personId}>
                {index > 0 ? <Divider /> : null}
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <Avatar name={pari.personName(balance.personId)} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-[15px]">
                    {pari.personName(balance.personId)}
                    {balance.personId === pari.currentPersonId ? (
                      <span className="ml-2 text-xs text-muted-foreground">{t("common.you")}</span>
                    ) : null}
                  </span>
                  <MoneyAmount
                    minor={balance.netMinor}
                    tone={balanceTone(balance.netMinor)}
                    showSign={balance.netMinor !== 0}
                  />
                </div>
              </div>
            ))}
          </Panel>
        ) : null}

        {tab === "People" ? (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-surface-strong py-4 text-[15px] font-medium transition-transform active:scale-[0.99]"
            >
              <UserPlus className="h-4 w-4" strokeWidth={2} />
              {t("invite.title")}
            </button>
          </div>
        ) : null}

        {tab === "Rules" ? (
          <Panel>
            <div className="space-y-1 px-4 py-4">
              <p className="text-[15px] font-medium tracking-tight">{t("groups.defaultSplit")}</p>
              <p className="text-sm text-muted-foreground">
                {defaults
                  ? memberIds
                      .map((id) => `${pari.personName(id)} ${defaults[id] ?? 0}%`)
                      .join(" · ")
                  : t("groups.equalBetweenEveryone")}
              </p>
            </div>
            <Divider />
            <div className="space-y-1 px-4 py-4">
              <p className="text-[15px] font-medium tracking-tight">{t("common.currency")}</p>
              <p className="text-sm text-muted-foreground">{group.currency}</p>
            </div>
            <Divider />
            <Link
              to="/groups/$groupId/edit"
              params={{ groupId }}
              className="block px-4 py-4 text-[15px]"
            >
              {t("groups.edit")}
            </Link>
          </Panel>
        ) : null}
      </Screen>
      <BottomNav />
      <InviteSheet
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        groupId={groupId}
        groupName={group.name}
      />
    </>
  );
}
