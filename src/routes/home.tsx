import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { BottomNav, Divider, Panel, Screen, TopBar } from "@/components/pari/AppShell";
import { AuthGate } from "@/components/pari/AuthGate";
import { BalanceDisplay } from "@/components/pari/MoneyAmount";
import { EmptyState } from "@/components/pari/EmptyState";
import { ExpenseRow, GroupRow } from "@/components/pari/rows";
import { usePari } from "@/data/store";
import { timeOfDayGreeting } from "@/lib/dates";
import { useT } from "@/lib/i18n";
import { setHideAmounts, useHideAmounts } from "@/lib/privacy";
import { Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/home")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Your overview — PARI" },
      {
        name: "description",
        content:
          "See what you're owed, what you owe and every shared expense — in one calm overview.",
      },
      { property: "og:title", content: "Your overview — PARI" },
      {
        property: "og:description",
        content: "The calm way to split shared expenses with the people around you.",
      },
    ],
  }),
  component: () => (
    <AuthGate>
      <HomeScreen />
    </AuthGate>
  ),
});

function HomeScreen() {
  const pari = usePari();
  const t = useT();
  const groups = pari.data.groups.filter((group) => !group.archived_at);
  const active = groups.filter((group) => pari.groupExpenses(group.id).length > 0);
  const recent = pari.recentExpenses(4);
  // Greeting depends on the device clock — render it only after hydration.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const hideAmounts = useHideAmounts();

  return (
    <>
      <Screen>
        <TopBar title={hydrated ? timeOfDayGreeting(pari.currentProfileName) : ""} />

        <div className="animate-rise flex items-start justify-between gap-3 px-1 pb-9">
          <BalanceDisplay
            className="min-w-0"
            minor={pari.netBalance}
            hint={
              pari.netBalance === 0
                ? t("home.settled")
                : t("home.acrossGroups", { count: active.length })
            }
          />
          <button
            type="button"
            onClick={() => setHideAmounts(!hideAmounts)}
            aria-pressed={hideAmounts}
            aria-label={hideAmounts ? t("profile.hideAmountsOn") : t("profile.hideAmountsOff")}
            className="-mr-1 mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground"
          >
            {hideAmounts ? (
              <EyeOff className="h-5 w-5" strokeWidth={1.6} />
            ) : (
              <Eye className="h-5 w-5" strokeWidth={1.6} />
            )}
          </button>
        </div>

        <div className="space-y-8">
          <Panel
            title={t("home.yourGroups")}
            action={
              <Link to="/groups" className="text-sm text-muted-foreground">
                {t("home.seeAll")}
              </Link>
            }
          >
            {active.length === 0 ? (
              <EmptyState
                title={groups.length === 0 ? t("home.noGroups") : t("home.groupsNoExpenses")}
                description={
                  groups.length === 0 ? t("home.noGroupsHint") : t("home.groupsNoExpensesHint")
                }
              />
            ) : (
              active.map((group, index) => (
                <div key={group.id}>
                  {index > 0 ? <Divider /> : null}
                  <GroupRow
                    id={group.id}
                    name={group.name}
                    memberNames={pari
                      .groupPersonIds(group.id)
                      .map((personId) => pari.personName(personId))}
                    balanceMinor={pari.myGroupBalance(group.id)}
                  />
                </div>
              ))
            )}
          </Panel>

          {recent.length > 0 ? (
            <Panel title={t("home.recent")}>
              {recent.map((expense, index) => (
                <div key={expense.id}>
                  {index > 0 ? <Divider /> : null}
                  <ExpenseRow
                    title={expense.title}
                    subtitle={t("home.paidBy", {
                      name: pari.personName(expense.paid_by_person_id),
                    })}
                    dateIso={expense.expense_date}
                    amountMinor={expense.total_minor}
                    currency={expense.currency}
                    originalAmountMinor={expense.original_total_minor ?? undefined}
                    originalCurrency={expense.original_currency ?? undefined}
                    expenseId={expense.id}
                  />
                </div>
              ))}
            </Panel>
          ) : null}
        </div>
      </Screen>
      <BottomNav />
    </>
  );
}
