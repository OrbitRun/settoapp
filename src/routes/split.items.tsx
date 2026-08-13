import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Screen } from "@/components/pari/AppShell";
import { FlowHeader } from "@/components/pari/FlowHeader";
import { BottomSheet } from "@/components/pari/BottomSheet";
import { PrimaryButton, SecondaryButton } from "@/components/pari/Buttons";
import { PersonChip } from "@/components/pari/PersonChip";
import { Avatar } from "@/components/pari/Avatar";
import { computeDraftAllocations, itemTotalMinor } from "@/data/draft";
import { usePari } from "@/data/store";
import { formatMinor } from "@/lib/money";
import { calculateEqualSplit } from "@/lib/split";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/split/items")({
  head: () => ({
    meta: [
      { title: "Split by item — PARI" },
      { name: "description", content: "Assign each line to the people who had it." },
      { property: "og:title", content: "Split by item — PARI" },
      { property: "og:description", content: "Assign each line to the people who had it." },
    ],
  }),
  component: ItemSplitScreen,
});

function ItemSplitScreen() {
  const pari = usePari();
  const navigate = useNavigate();
  const { draft, setDraft } = pari;
  const [selected, setSelected] = useState<string[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [bulkPeople, setBulkPeople] = useState<string[]>([]);

  const people = useMemo(
    () => draft.participants.map((id) => ({ id, name: pari.personName(id) })),
    [draft.participants, pari],
  );

  const items = draft.items.filter((item) => item.isShared);
  const allocations = computeDraftAllocations(draft);
  const total = items.reduce((sum, item) => sum + itemTotalMinor(item), 0);

  const toggleAssignment = (itemId: string, personId: string) =>
    setDraft((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id !== itemId) return item;
        const base = item.assigned.length > 0 ? item.assigned : prev.participants;
        return {
          ...item,
          assigned: base.includes(personId)
            ? base.filter((id) => id !== personId)
            : [...base, personId],
        };
      }),
    }));

  const applyBulk = () => {
    setDraft((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        selected.includes(item.id) ? { ...item, assigned: bulkPeople } : item,
      ),
    }));
    setSelected([]);
    setBulkPeople([]);
    setAssignOpen(false);
  };

  const confirm = () => {
    const expense = pari.addExpense({
      groupId: draft.groupId,
      title: draft.title || draft.merchant || "Receipt",
      merchant: draft.merchant,
      paidByPersonId: draft.paidByPersonId,
      totalMinor: total,
      allocations,
      source: "receipt",
      items: draft.items,
    });
    navigate({ to: "/split/result", search: { expenseId: expense.id } });
  };

  return (
    <Screen className="pb-48">
      <FlowHeader title="Split by item" subtitle={draft.merchant ?? undefined} />

      <div className="space-y-2">
        {items.map((item) => {
          const assigned = item.assigned.length > 0 ? item.assigned : draft.participants;
          const share = calculateEqualSplit(itemTotalMinor(item), assigned)[0]?.amountMinor ?? 0;
          const isSelected = selected.includes(item.id);

          return (
            <div
              key={item.id}
              className={cn(
                "rounded-3xl bg-surface p-4 shadow-soft transition-colors",
                isSelected && "bg-surface-strong",
              )}
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setSelected((prev) =>
                      prev.includes(item.id)
                        ? prev.filter((id) => id !== item.id)
                        : [...prev, item.id],
                    )
                  }
                  className="min-w-0 text-left"
                >
                  <span className="block truncate text-[15px] font-medium tracking-tight">
                    {item.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {assigned.length === 1
                      ? `${pari.personName(assigned[0]!)} · ${formatMinor(share, { compact: false })}`
                      : `${formatMinor(share, { compact: false })} each`}
                  </span>
                </button>
                <span className="tnum shrink-0 text-[15px] font-medium">
                  {formatMinor(itemTotalMinor(item), { currency: "" }).trim()}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {people.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => toggleAssignment(item.id, person.id)}
                    aria-label={`${person.name} shares ${item.name}`}
                    className="rounded-full"
                  >
                    <Avatar
                      name={person.name}
                      size="sm"
                      selected={assigned.includes(person.id)}
                      className={cn(!assigned.includes(person.id) && "opacity-40")}
                    />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center bg-gradient-to-t from-background via-background to-transparent pb-8 pt-10">
        <div className="pointer-events-auto w-full max-w-[430px] space-y-2 px-5">
          {selected.length > 0 ? (
            <>
              <p className="pb-1 text-center text-sm text-muted-foreground">
                {selected.length} {selected.length === 1 ? "item" : "items"} selected
              </p>
              <PrimaryButton onClick={() => setAssignOpen(true)}>Assign people</PrimaryButton>
              <SecondaryButton onClick={() => setSelected([])}>Clear</SecondaryButton>
            </>
          ) : (
            <PrimaryButton onClick={confirm}>
              Confirm split · {formatMinor(total, { compact: false })}
            </PrimaryButton>
          )}
        </div>
      </div>

      <BottomSheet
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Assign people"
        description={`Applies to ${selected.length} ${selected.length === 1 ? "item" : "items"}`}
      >
        <div className="flex flex-wrap gap-2 pb-6">
          {people.map((person) => (
            <PersonChip
              key={person.id}
              name={person.name}
              selected={bulkPeople.includes(person.id)}
              onClick={() =>
                setBulkPeople((prev) =>
                  prev.includes(person.id)
                    ? prev.filter((id) => id !== person.id)
                    : [...prev, person.id],
                )
              }
            />
          ))}
        </div>
        <PrimaryButton onClick={applyBulk} disabled={bulkPeople.length === 0}>
          Apply
        </PrimaryButton>
      </BottomSheet>
    </Screen>
  );
}
