import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Screen } from "@/components/pari/AppShell";
import { FlowHeader } from "@/components/pari/FlowHeader";
import { PrimaryButton } from "@/components/pari/Buttons";
import { GroupPicker } from "@/components/pari/GroupPicker";
import { ParticipantSelector } from "@/components/pari/ParticipantSelector";
import { NumericField } from "@/components/pari/NumericField";
import { PercentageSplitEditor } from "@/components/pari/PercentageSplitEditor";
import { SplitSelector } from "@/components/pari/SplitSelector";
import { PersonChip } from "@/components/pari/PersonChip";
import { MoneyAmount } from "@/components/pari/MoneyAmount";
import { computeDraftAllocations } from "@/data/draft";
import { usePari } from "@/data/store";
import { formatMinor, toMajor, toMinor } from "@/lib/money";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/split/amount")({
  head: () => ({
    meta: [
      { title: "New expense — PARI" },
      { name: "description", content: "Enter an amount, pick the people, done." },
      { property: "og:title", content: "New expense — PARI" },
      { property: "og:description", content: "Enter an amount, pick the people, done." },
    ],
  }),
  component: ManualExpenseScreen,
});

function ManualExpenseScreen() {
  const pari = usePari();
  const navigate = useNavigate();
  const { draft, setDraft } = pari;
  const [showPaidBy, setShowPaidBy] = useState(false);

  const people = useMemo(() => {
    const ids = draft.groupId ? pari.groupPersonIds(draft.groupId) : pari.data.people.map((p) => p.id);
    return ids.map((id) => ({ id, name: pari.personName(id) }));
  }, [draft.groupId, pari]);

  const participants = people.filter((person) => draft.participants.includes(person.id));
  const allocations = computeDraftAllocations(draft);
  const perPerson = allocations[0]?.amountMinor ?? 0;
  const everyoneEqual =
    draft.mode === "equal" && allocations.length > 0 && allocations.every((a) => a.amountMinor === perPerson);

  const canSave =
    draft.amountMinor > 0 &&
    draft.participants.length > 0 &&
    (draft.mode !== "percentage" ||
      Math.round(
        draft.participants.reduce((sum, id) => sum + (draft.percentages[id] ?? 0), 0),
      ) === 100);

  const setGroup = (groupId: string | null) => {
    const defaults = groupId ? pari.groupDefaultPercentages(groupId) : null;
    const ids = groupId ? pari.groupPersonIds(groupId) : [pari.currentPersonId];
    setDraft((prev) => ({
      ...prev,
      groupId,
      participants: ids,
      mode: defaults ? "percentage" : "equal",
      percentages: defaults ?? {},
      usingGroupDefault: Boolean(defaults),
    }));
  };

  const save = () => {
    const expense = pari.addExpense({
      groupId: draft.groupId,
      title: draft.title,
      merchant: draft.merchant,
      paidByPersonId: draft.paidByPersonId,
      totalMinor: draft.amountMinor,
      allocations,
      source: "manual",
    });
    navigate({ to: "/split/result", search: { expenseId: expense.id } });
  };

  return (
    <Screen className="pb-40">
      <FlowHeader title="New expense" variant="close" onClose={() => navigate({ to: "/" })} />

      <div className="px-1 pb-10 pt-4 text-center">
        <div className="flex items-baseline justify-center gap-2">
          <NumericField
            autoFocus
            value={toMajor(draft.amountMinor)}
            onChange={(next) => setDraft((prev) => ({ ...prev, amountMinor: toMinor(next) }))}
            min={0}
            ariaLabel="Amount"
            className="w-full max-w-[70%]"
            inputClassName="text-right text-[52px] font-semibold tracking-[-0.04em]"
          />
          <span className="text-[22px] font-medium text-muted-foreground">DKK</span>
        </div>

        <input
          value={draft.title}
          onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
          placeholder="What was it?"
          className="mt-4 w-full bg-transparent text-center text-[17px] tracking-tight outline-none placeholder:text-muted-foreground/60"
        />
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <GroupPicker groupId={draft.groupId} onChange={setGroup} />

          <button
            type="button"
            onClick={() => setShowPaidBy((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-2xl bg-surface px-4 py-4 text-left shadow-soft"
          >
            <span className="text-[15px] text-muted-foreground">Paid by</span>
            <span className="text-[15px] font-medium tracking-tight">
              {draft.paidByPersonId === pari.currentPersonId
                ? "You"
                : pari.personName(draft.paidByPersonId)}
            </span>
          </button>

          {showPaidBy ? (
            <div className="flex flex-wrap gap-2 px-1 pt-1">
              {people.map((person) => (
                <PersonChip
                  key={person.id}
                  name={person.name}
                  selected={draft.paidByPersonId === person.id}
                  onClick={() => {
                    setDraft((prev) => ({ ...prev, paidByPersonId: person.id }));
                    setShowPaidBy(false);
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>

        {draft.usingGroupDefault ? (
          <div className="flex items-center justify-between rounded-2xl bg-positive-soft px-4 py-3.5">
            <p className="text-sm">
              Using group split ·{" "}
              {participants.map((p) => draft.percentages[p.id] ?? 0).join("/")}
            </p>
            <button
              type="button"
              onClick={() => setDraft((prev) => ({ ...prev, usingGroupDefault: false }))}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Change
            </button>
          </div>
        ) : null}

        <ParticipantSelector
          people={people}
          selected={draft.participants}
          onToggle={(personId) =>
            setDraft((prev) => ({
              ...prev,
              participants: prev.participants.includes(personId)
                ? prev.participants.filter((id) => id !== personId)
                : [...prev.participants, personId],
            }))
          }
          onSelectAll={() =>
            setDraft((prev) => ({
              ...prev,
              participants:
                prev.participants.length === people.length ? [] : people.map((p) => p.id),
            }))
          }
        />

        <section className="space-y-4 rounded-3xl bg-surface p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-muted-foreground">Split</p>
            <SplitSelector
              mode={draft.mode}
              onChange={(mode) =>
                setDraft((prev) => ({
                  ...prev,
                  mode,
                  usingGroupDefault: mode === "percentage" ? prev.usingGroupDefault : false,
                  percentages:
                    mode === "percentage" && Object.keys(prev.percentages).length === 0
                      ? Object.fromEntries(
                          prev.participants.map((id) => [
                            id,
                            Math.round(100 / Math.max(prev.participants.length, 1)),
                          ]),
                        )
                      : prev.percentages,
                  shares:
                    mode === "shares"
                      ? Object.fromEntries(prev.participants.map((id) => [id, prev.shares[id] ?? 1]))
                      : prev.shares,
                }))
              }
            />
          </div>

          {draft.mode === "equal" && everyoneEqual ? (
            <p className="text-center text-[26px] font-semibold tracking-[-0.03em]">
              {formatMinor(perPerson, { compact: false })}
              <span className="ml-2 text-[15px] font-normal text-muted-foreground">each</span>
            </p>
          ) : null}

          {draft.mode === "percentage" ? (
            <PercentageSplitEditor
              totalMinor={draft.amountMinor}
              people={participants}
              percentages={draft.percentages}
              onChange={(personId, percentage) =>
                setDraft((prev) => ({
                  ...prev,
                  percentages: { ...prev.percentages, [personId]: percentage },
                }))
              }
            />
          ) : null}

          {draft.mode === "shares" ? (
            <div className="space-y-3">
              {participants.map((person) => (
                <div key={person.id} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-[15px]">{person.name}</span>
                  <MoneyAmount
                    minor={
                      allocations.find((a) => a.personId === person.id)?.amountMinor ?? 0
                    }
                    tone="muted"
                    size="sm"
                  />
                  <div className="flex items-center gap-2">
                    {[1, 2, 3].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            shares: { ...prev.shares, [person.id]: value },
                          }))
                        }
                        className={cn(
                          "h-9 w-9 rounded-xl text-sm font-medium transition-colors",
                          (draft.shares[person.id] ?? 1) === value
                            ? "bg-primary text-primary-foreground"
                            : "bg-surface-strong text-muted-foreground",
                        )}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {draft.mode === "exact" ? (
            <div className="space-y-3">
              {participants.map((person) => (
                <div key={person.id} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-[15px]">{person.name}</span>
                  <NumericField
                    value={toMajor(draft.exact[person.id] ?? 0)}
                    onChange={(next) =>
                      setDraft((prev) => ({
                        ...prev,
                        exact: { ...prev.exact, [person.id]: toMinor(next) },
                      }))
                    }
                    min={0}
                    ariaLabel={`${person.name} amount`}
                    suffix={<span className="text-xs">DKK</span>}
                    className="h-11 w-32 rounded-xl bg-surface-strong px-3"
                    inputClassName="text-right text-[15px] font-medium"
                  />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                {(() => {
                  const assigned = participants.reduce(
                    (sum, person) => sum + (draft.exact[person.id] ?? 0),
                    0,
                  );
                  const diff = draft.amountMinor - assigned;
                  if (diff === 0) return "Adds up exactly";
                  return diff > 0
                    ? `${formatMinor(diff)} left to assign`
                    : `${formatMinor(-diff)} too much`;
                })()}
              </p>
            </div>
          ) : null}
        </section>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center bg-gradient-to-t from-background via-background to-transparent pb-8 pt-10">
        <div className="pointer-events-auto w-full max-w-[430px] px-5">
          <PrimaryButton onClick={save} disabled={!canSave}>
            Save split
          </PrimaryButton>
        </div>
      </div>
    </Screen>
  );
}
