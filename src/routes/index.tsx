import { createFileRoute, Link } from "@tanstack/react-router";

import { BottomNav, Divider, Panel, Screen, TopBar } from "@/components/pari/AppShell";
import { BalanceDisplay } from "@/components/pari/MoneyAmount";
import { EmptyState } from "@/components/pari/EmptyState";
import { ExpenseRow, GroupRow } from "@/components/pari/rows";
import { usePari } from "@/data/store";
import { timeOfDayGreeting } from "@/lib/dates";

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
                ? "Everything is settled."
                : `Across ${active.length} groups`
            }
          />
        </div>

        <div className="space-y-8">
          <Panel
            title="Your groups"
            action={
              <Link to="/groups" className="text-sm text-muted-foreground">
                See all
              </Link>
            }
          >
            {active.length === 0 ? (
              <EmptyState
                title="No shared expenses yet"
                description="Split your first expense in seconds."
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

          <Panel title="Recent">
            {recent.map((expense, index) => (
              <div key={expense.id}>
                {index > 0 ? <Divider /> : null}
                <ExpenseRow
                  title={expense.title}
                  subtitle={`Paid by ${pari.personName(expense.paid_by_person_id)}`}
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
