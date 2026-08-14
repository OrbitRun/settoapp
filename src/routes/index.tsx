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

function HomeScreen() {
  const pari = usePari();
  const t = useT();
  const groups = pari.data.groups.filter((group) => !group.archived_at);
  const active = groups.filter((group) => pari.groupExpenses(group.id).length > 0);
  const recent = pari.recentExpenses(4);

  return (
    <>
      <Screen>
        <TopBar title={timeOfDayGreeting(pari.currentProfileName)} />

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
