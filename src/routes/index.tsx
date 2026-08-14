import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { BottomNav, Divider, Panel, Screen, TopBar } from "@/components/pari/AppShell";
import { BalanceDisplay } from "@/components/pari/MoneyAmount";
import { EmptyState } from "@/components/pari/EmptyState";
import { ExpenseRow, GroupRow } from "@/components/pari/rows";
import { usePari } from "@/data/store";
import { timeOfDayGreeting } from "@/lib/dates";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PARI — Share anything. Settle easily." },
      {
        name: "description",
        content:
          "See what you're owed, what you owe and every shared expense — in one calm overview.",
      },
      { property: "og:title", content: "PARI — Share anything. Settle easily." },
      {
        property: "og:description",
        content: "The calm way to split shared expenses with the people around you.",
      },
    ],
  }),
  component: HomeScreen,
});

function WelcomeScreen() {
  const t = useT();
  return (
    <div className="min-h-svh bg-background">
      <div className="mx-auto flex min-h-svh w-full max-w-[430px] flex-col px-7 pb-12 pt-16">
        <div className="animate-rise flex flex-1 flex-col justify-center">
          <p className="text-sm text-muted-foreground">PARI</p>
          <h1 className="mt-4 whitespace-pre-line text-[38px] font-semibold leading-[1.08] tracking-[-0.035em]">
            {t("welcome.title")}
          </h1>
          <p className="mt-4 max-w-[28ch] text-[17px] text-muted-foreground">
            {t("welcome.subtitle")}
          </p>
        </div>
        <div className="space-y-3">
          <Link
            to="/split/amount"
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-primary text-[15px] font-medium text-primary-foreground"
          >
            {t("welcome.primary")}
          </Link>
          <Link
            to="/auth"
            search={{}}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-surface-strong text-[15px] font-medium"
          >
            {t("welcome.secondary")}
          </Link>
          <p className="pt-2 text-center text-xs text-muted-foreground">{t("welcome.note")}</p>
        </div>
      </div>
    </div>
  );
}

function HomeScreen() {
  const pari = usePari();
  const t = useT();
  const groups = pari.data.groups.filter((group) => !group.archived_at);
  const active = groups.filter((group) => pari.groupExpenses(group.id).length > 0);
  const recent = pari.recentExpenses(4);
  // Greeting depends on the device clock — render it only after hydration.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // A brand-new guest gets the welcome screen, not an empty dashboard.
  if (pari.isGuest && pari.data.expenses.length === 0) return <WelcomeScreen />;



  return (
    <>
      <Screen>
        <TopBar title={hydrated ? timeOfDayGreeting(pari.currentProfileName) : ""} />

        <div className="animate-rise px-1 pb-9">
          <BalanceDisplay
            minor={pari.netBalance}
            hint={
              pari.netBalance === 0
                ? t("home.settled")
                : t("home.acrossGroups", { count: active.length })
            }
          />
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
                title={t("home.noExpenses")}
                description={t("home.noExpensesHint")}
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

          <Panel title={t("home.recent")}>
            {recent.map((expense, index) => (
              <div key={expense.id}>
                {index > 0 ? <Divider /> : null}
                <ExpenseRow
                  title={expense.title}
                  subtitle={t("home.paidBy", { name: pari.personName(expense.paid_by_person_id) })}
                  dateIso={expense.expense_date}
                  amountMinor={expense.total_minor}
                />
              </div>
            ))}
          </Panel>
        </div>
      </Screen>
      <BottomNav />
    </>
  );
}
