import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";

import { Divider, Panel, Screen } from "@/components/pari/AppShell";
import { PrimaryButton, SecondaryButton } from "@/components/pari/Buttons";
import { Avatar } from "@/components/pari/Avatar";
import { MoneyAmount } from "@/components/pari/MoneyAmount";
import { EmptyState } from "@/components/pari/EmptyState";
import { usePari } from "@/data/store";
import { formatMinor } from "@/lib/money";

const searchSchema = z.object({ expenseId: z.string().optional() });

export const Route = createFileRoute("/split/result")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Split saved — PARI" },
      { name: "description", content: "Everyone's share, calculated to the øre." },
      { property: "og:title", content: "Split saved — PARI" },
      { property: "og:description", content: "Everyone's share, calculated to the øre." },
    ],
  }),
  component: ResultScreen,
});

function ResultScreen() {
  const { expenseId } = Route.useSearch();
  const pari = usePari();
  const navigate = useNavigate();

  const expense = pari.data.expenses.find((e) => e.id === expenseId);

  if (!expense) {
    return (
      <Screen>
        <EmptyState
          title="Nothing to show"
          description="This split is no longer available."
          action={
            <Link to="/" className="text-sm underline underline-offset-4">
              Go home
            </Link>
          }
        />
      </Screen>
    );
  }

  const allocations = pari
    .expenseAllocations(expense.id)
    .sort((a, b) => b.amountMinor - a.amountMinor);

  return (
    <Screen>
      <div className="animate-rise px-1 pb-8 pt-16 text-center">
        <p className="text-sm text-muted-foreground">Done</p>
        <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.03em]">{expense.title}</h1>
        <p className="tnum mt-2 text-[17px] text-muted-foreground">
          {formatMinor(expense.total_minor, { compact: false })}
        </p>
      </div>

      <Panel>
        {allocations.map((allocation, index) => (
          <div key={allocation.personId}>
            {index > 0 ? <Divider /> : null}
            <div className="flex items-center gap-3 px-4 py-3.5">
              <Avatar name={pari.personName(allocation.personId)} size="sm" />
              <span className="min-w-0 flex-1 truncate text-[15px]">
                {pari.personName(allocation.personId)}
              </span>
              <MoneyAmount minor={allocation.amountMinor} compact={false} />
            </div>
          </div>
        ))}
      </Panel>

      <div className="mt-8 space-y-2">
        {expense.group_id ? (
          <PrimaryButton
            onClick={() => {
              pari.resetDraft();
              navigate({ to: "/groups/$groupId", params: { groupId: expense.group_id! } });
            }}
          >
            Open group
          </PrimaryButton>
        ) : (
          <PrimaryButton
            onClick={() => {
              pari.resetDraft();
              navigate({ to: "/groups/new" });
            }}
          >
            Save these people as a group
          </PrimaryButton>
        )}

        <SecondaryButton
          onClick={() => {
            const lines = allocations
              .map(
                (allocation) =>
                  `${pari.personName(allocation.personId)}: ${formatMinor(allocation.amountMinor, { compact: false })}`,
              )
              .join("\n");
            void navigator.clipboard?.writeText(`${expense.title}\n${lines}`);
            toast.success("Result copied");
          }}
        >
          Share result
        </SecondaryButton>

        <button
          type="button"
          onClick={() => {
            pari.resetDraft();
            navigate({ to: "/" });
          }}
          className="mx-auto block py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Done
        </button>
      </div>
    </Screen>
  );
}
