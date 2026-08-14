import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, Minus, Plus } from "lucide-react";

import { Screen } from "@/components/pari/AppShell";
import { FlowHeader } from "@/components/pari/FlowHeader";
import { PrimaryButton } from "@/components/pari/Buttons";
import { GroupPicker } from "@/components/pari/GroupPicker";
import { ParticipantPicker } from "@/components/pari/ParticipantPicker";
import { NumericField } from "@/components/pari/NumericField";
import { PercentageSplitEditor } from "@/components/pari/PercentageSplitEditor";
import { SplitSelector } from "@/components/pari/SplitSelector";
import { PersonChip } from "@/components/pari/PersonChip";
import { MoneyAmount } from "@/components/pari/MoneyAmount";
import { computeDraftAllocations } from "@/data/draft";
import { usePari } from "@/data/store";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  currencyLabel,
  formatMinor,
  formatMinorNumber,
  toMajor,
  toMinor,
} from "@/lib/money";


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
  const t = useT();
  const navigate = useNavigate();
  const { draft, setDraft } = pari;
  const [showPaidBy, setShowPaidBy] = useState(false);
  const amountText =
    draft.amountMinor > 0 ? formatMinorNumber(draft.amountMinor) : "0";
  const heroSize =
    amountText.length <= 5 ? 60 : amountText.length <= 7 ? 52 : amountText.length <= 10 ? 42 : 32;
  const suffixSize = Math.max(18, Math.round(heroSize / 3));
  const heroStyle = { fontSize: `${heroSize}px`, lineHeight: 1.05 } as const;



  const people = useMemo(
    () => pari.data.people.map((person) => ({ id: person.id, name: person.name })),
    [pari.data.people],
  );

  const participants = draft.participants.map((id) => ({ id, name: pari.personName(id) }));
  const allocations = computeDraftAllocations(draft);
  const perPerson = allocations[0]?.amountMinor ?? 0;
  const everyoneEqual =
    draft.mode === "equal" &&
    allocations.length > 0 &&
    allocations.every((a) => a.amountMinor === perPerson);

  const exactSum = draft.participants.reduce((sum, id) => sum + (draft.exact[id] ?? 0), 0);
  const exactBalanced = exactSum === draft.amountMinor;
  const percentageBalanced =
    Math.round(draft.participants.reduce((sum, id) => sum + (draft.percentages[id] ?? 0), 0)) ===
    100;

  const canSave =
    draft.amountMinor > 0 &&
    draft.participants.length > 0 &&
    (draft.mode !== "percentage" || percentageBalanced) &&
    (draft.mode !== "exact" || exactBalanced);

  const showGroups = !pari.isGuest && pari.data.groups.length > 0;

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

  const save = async () => {
    const expense = await pari.addExpense({
      groupId: draft.groupId,
      title: draft.title,
      merchant: draft.merchant,
      paidByPersonId: draft.paidByPersonId,
      totalMinor: draft.amountMinor,
      allocations,
      source: "manual",
    });
    if (!expense) return;
    navigate({ to: "/split/result", search: { expenseId: expense.id } });
  };

  return (
    <Screen className="pb-40">
      <FlowHeader
        title={t("split.newExpense")}
        variant="close"
        onClose={() => navigate({ to: pari.isGuest ? "/" : "/home" })}
      />

      <div className="px-1 pb-8 pt-2 text-center">
        <div className="flex items-baseline justify-center gap-2">
          {/* An invisible mirror sizes the field to its content so the amount and
              the currency stay centered as one unit at any length. */}
          <span className="relative inline-block">
            <span aria-hidden className={cn(heroClass, "invisible whitespace-pre px-[0.3em]")}>
              {amountChars}
            </span>
            <NumericField
              autoFocus
              value={toMajor(draft.amountMinor)}
              onChange={(next) => setDraft((prev) => ({ ...prev, amountMinor: toMinor(next) }))}
              min={0}
              ariaLabel={t("split.amount")}
              className="absolute inset-0"
              inputClassName={cn(heroClass, "text-center")}
            />
          </span>
          <span className="text-[20px] font-medium text-muted-foreground">{currencyLabel()}</span>
        </div>


        <input
          value={draft.title}
          onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
          placeholder={t("split.what")}
          className="mt-4 w-full bg-transparent text-center text-[17px] tracking-tight outline-none placeholder:text-muted-foreground/60"
        />
      </div>


      <div className="space-y-6">
        {showGroups ? (
          <div className="space-y-2">
            <GroupPicker groupId={draft.groupId} onChange={setGroup} />

            <button
              type="button"
              onClick={() => setShowPaidBy((prev) => !prev)}
              className="flex w-full items-center justify-between rounded-2xl bg-surface px-4 py-4 text-left shadow-soft"
            >
              <span className="text-[15px] text-muted-foreground">{t("split.paidBy")}</span>
              <span className="text-[15px] font-medium tracking-tight">
                {draft.paidByPersonId === pari.currentPersonId
                  ? t("common.you")
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
        ) : null}

        <ParticipantPicker
          selected={draft.participants}
          onChange={(ids) => setDraft((prev) => ({ ...prev, participants: ids }))}
        />

        <section className="space-y-4 rounded-3xl bg-surface p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-muted-foreground">{t("split.distribution")}</p>
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
                      ? Object.fromEntries(
                          prev.participants.map((id) => [id, prev.shares[id] ?? 1]),
                        )
                      : prev.shares,
                }))
              }
            />
          </div>

          {draft.mode === "equal" ? (
            everyoneEqual ? (
              <div className="text-center">
                <p className="text-[26px] font-semibold tracking-[-0.03em]">
                  {formatMinor(perPerson, { compact: false })}
                  <span className="ml-2 text-[15px] font-normal text-muted-foreground">
                    {t("participants.each")}
                  </span>
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {t(draft.participants.length === 1 ? "participants.personCount" : "participants.peopleCount", { count: draft.participants.length })}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {participants.map((person) => (
                  <div key={person.id} className="flex items-center justify-between">
                    <span className="min-w-0 flex-1 truncate text-[15px]">{person.name}</span>
                    <MoneyAmount
                      minor={
                        allocations.find((a) => a.personId === person.id)?.amountMinor ?? 0
                      }
                      compact={false}
                      size="sm"
                    />
                  </div>
                ))}
              </div>
            )
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
                    ariaLabel={person.name}
                    suffix={<span className="text-sm">{currencyLabel()}</span>}
                    className="h-11 w-[132px] shrink-0 rounded-xl bg-surface-strong px-3"
                    inputClassName="text-right text-[15px] font-medium"
                  />
                </div>
              ))}
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {exactBalanced ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-positive" strokeWidth={2} />
                    {t("split.allocated", {
                      allocated: formatMinor(exactSum, { compact: false }),
                      total: formatMinor(draft.amountMinor, { compact: false }),
                    })}
                  </>
                ) : exactSum < draft.amountMinor ? (
                  t("split.remaining", {
                    amount: formatMinor(draft.amountMinor - exactSum, { compact: false }),
                  })
                ) : (
                  t("split.over", {
                    amount: formatMinor(exactSum - draft.amountMinor, { compact: false }),
                  })
                )}
              </p>
            </div>
          ) : null}

          {draft.mode === "shares" ? (
            <div className="space-y-3">
              {participants.map((person) => {
                const shares = draft.shares[person.id] ?? 1;
                const setShares = (next: number) =>
                  setDraft((prev) => ({
                    ...prev,
                    shares: { ...prev.shares, [person.id]: Math.max(1, Math.min(20, next)) },
                  }));

                return (
                  <div key={person.id} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate text-[15px]">{person.name}</span>
                    <MoneyAmount
                      minor={allocations.find((a) => a.personId === person.id)?.amountMinor ?? 0}
                      tone="muted"
                      size="sm"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="-"
                        onClick={() => setShares(shares - 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-strong active:scale-95"
                      >
                        <Minus className="h-4 w-4" strokeWidth={2} />
                      </button>
                      <span className="tnum w-6 text-center text-[15px] font-medium">{shares}</span>
                      <button
                        type="button"
                        aria-label="+"
                        onClick={() => setShares(shares + 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-strong active:scale-95"
                      >
                        <Plus className="h-4 w-4" strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center bg-gradient-to-t from-background via-background to-transparent pb-8 pt-10">
        <div className="pointer-events-auto w-full max-w-[430px] px-5">
          <PrimaryButton onClick={save} disabled={!canSave}>
            {t("split.finish")}
            {draft.amountMinor > 0
              ? ` · ${formatMinor(draft.amountMinor, { compact: false })}`
              : ""}
          </PrimaryButton>
        </div>
      </div>
    </Screen>
  );
}
