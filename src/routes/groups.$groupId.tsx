import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, UserPlus } from "lucide-react";

import { BottomNav, Divider, Panel, Screen } from "@/components/pari/AppShell";
import { FlowHeader } from "@/components/pari/FlowHeader";
import { Avatar } from "@/components/pari/Avatar";
import { BalanceDisplay, MoneyAmount, balanceTone } from "@/components/pari/MoneyAmount";
import { EmptyState } from "@/components/pari/EmptyState";
import { ExpenseRow } from "@/components/pari/rows";
import { emptyDraft } from "@/data/draft";
import { usePari } from "@/data/store";
import { useT } from "@/lib/i18n";
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

const TABS = ["Expenses", "People", "Rules"] as const;

function GroupDetailScreen() {
  const { groupId } = Route.useParams();
  const pari = usePari();
  const navigate = useNavigate();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Expenses");
  const [inviteOpen, setInviteOpen] = useState(false);
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
        <FlowHeader title={group.name} subtitle={`${memberIds.length} members`} />

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
              key={option}
              type="button"
              onClick={() => setTab(option)}
              className={cn(
                "flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors",
                tab === option
                  ? "bg-surface text-foreground shadow-soft"
                  : "text-muted-foreground",
              )}
            >
              {option}
            </button>
          ))}
        </div>

        {tab === "Expenses" ? (
          <div className="space-y-6">
            <Panel>
              {expenses.length === 0 ? (
                <EmptyState
                  title={t("groups.noExpenses")}
                  description="Add the first one and PARI keeps the balance."
                />
              ) : (
                expenses.map((expense, index) => (
                  <div key={expense.id}>
                    {index > 0 ? <Divider /> : null}
                    <ExpenseRow
                      title={expense.title}
                      subtitle={`Paid by ${pari.personName(expense.paid_by_person_id)}`}
                      dateIso={expense.expense_date}
                      amountMinor={expense.total_minor}
                    />
                  </div>
                ))
              )}
            </Panel>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={addExpense}
                className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-[15px] font-medium text-primary-foreground transition-transform active:scale-[0.99]"
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
                Add expense
              </button>
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                className="flex items-center justify-center gap-2 rounded-2xl bg-surface-strong py-4 text-[15px] font-medium transition-transform active:scale-[0.99]"
              >
                <UserPlus className="h-4 w-4" strokeWidth={2} />
                {t("invite.title")}
              </button>
              <Link
                to="/settle/$groupId"
                params={{ groupId }}
                className="py-3 text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Settle up
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
                      <span className="ml-2 text-xs text-muted-foreground">You</span>
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
              <p className="text-[15px] font-medium tracking-tight">Default split</p>
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
              <p className="text-[15px] font-medium tracking-tight">Currency</p>
              <p className="text-sm text-muted-foreground">{group.currency}</p>
            </div>
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
