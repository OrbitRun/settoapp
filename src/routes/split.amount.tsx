import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Screen } from "@/components/pari/AppShell";
import { FlowHeader } from "@/components/pari/FlowHeader";
import { PrimaryButton } from "@/components/pari/Buttons";
import { GroupPicker } from "@/components/pari/GroupPicker";
import { ParticipantPicker } from "@/components/pari/ParticipantPicker";
import { NumericField } from "@/components/pari/NumericField";
import { SplitRuleEditor, isRuleComplete, seedRule } from "@/components/pari/SplitRuleEditor";
import { SplitSelector } from "@/components/pari/SplitSelector";
import { PersonChip } from "@/components/pari/PersonChip";
import { computeDraftAllocations } from "@/data/draft";
import { usePari } from "@/data/store";
import { useT } from "@/lib/i18n";
import { CurrencyPanel } from "@/components/pari/CurrencyPanel";
import { useMoneyLock } from "@/hooks/useMoneyLock";
import { currencyLabel, formatMinorIn, formatMinorNumber, toMajor, toMinor } from "@/lib/money";

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
  const [busy, setBusy] = useState(false);
  const lock = useMoneyLock({
    currency: draft.currency,
    systemCurrency: pari.currency,
    totalMinor: draft.amountMinor,
  });
  const amountText = draft.amountMinor > 0 ? formatMinorNumber(draft.amountMinor) : "0";

  const heroSize =
    amountText.length <= 5 ? 60 : amountText.length <= 7 ? 52 : amountText.length <= 10 ? 42 : 32;
  const suffixSize = Math.max(18, Math.round(heroSize / 3));
  const heroStyle = { fontSize: `${heroSize}px`, lineHeight: 1.05 } as const;

  const participants = draft.participants.map((id) => ({ id, name: pari.personName(id) }));

  const allocations = computeDraftAllocations(draft);

  const rule = {
    mode: draft.mode,
    percentages: draft.percentages,
    shares: draft.shares,
    exact: draft.exact,
  };

  const canSave =
    draft.amountMinor > 0 &&
    draft.participants.length > 0 &&
    isRuleComplete(rule, participants, draft.amountMinor);

  const showGroups = !pari.isGuest && pari.data.groups.length > 0;

  // Selecting a group loads its members and its saved default rule.
  const setGroup = (groupId: string | null) => {
    const groupDefault = groupId ? pari.groupRule(groupId) : null;
    const ids = groupId ? pari.groupPersonIds(groupId) : [pari.currentPersonId];
    setDraft((prev) => ({
      ...prev,
      groupId,
      participants: ids,
      paidByPersonId: ids.includes(prev.paidByPersonId)
        ? prev.paidByPersonId
        : (ids[0] ?? prev.paidByPersonId),
      mode: groupDefault?.mode ?? "equal",
      percentages: groupDefault?.percentages ?? {},
      shares: groupDefault?.shares ?? {},
      exact: {},
      usingGroupDefault: Boolean(groupDefault) && groupDefault?.mode !== "equal",
    }));
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const expense = await pari.addExpense({
        groupId: draft.groupId,
        title: draft.title,
        merchant: draft.merchant,
        paidByPersonId: draft.paidByPersonId,
        totalMinor: draft.amountMinor,
        allocations,
        source: "manual",
        ...(lock.money ? { money: lock.money } : {}),
      });

      if (!expense) return;
      navigate({ to: "/split/result", search: { expenseId: expense.id } });
    } catch {
      toast.error(t("common.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen className="pb-40">
      <FlowHeader
        title={t("split.newExpense")}
        variant="close"
        onClose={() => navigate({ to: pari.isGuest ? "/" : "/home" })}
      />

      <div className="px-1 pb-6 pt-1 text-center">
        <div className="inline-flex w-full max-w-full items-baseline justify-center gap-2">
          {/* An invisible mirror sizes the field to its content so the amount and
              the currency stay centered as one unit at any length. */}
          <span className="relative inline-block max-w-full">
            <span
              aria-hidden
              className="invisible whitespace-pre px-[0.06em] font-semibold tracking-[-0.04em]"
              style={heroStyle}
            >
              {amountText}
            </span>
            <NumericField
              showZero
              value={toMajor(draft.amountMinor)}
              onChange={(next) => setDraft((prev) => ({ ...prev, amountMinor: toMinor(next) }))}
              min={0}
              ariaLabel={t("split.amount")}
              className="absolute inset-0"
              format={(value) => formatMinorNumber(toMinor(value))}
              inputClassName="text-center font-semibold tracking-[-0.04em] text-foreground"
              style={heroStyle}
            />
          </span>
          <span
            className="shrink-0 font-medium text-muted-foreground"
            style={{ fontSize: `${suffixSize}px` }}
          >
            {currencyLabel(draft.currency)}
          </span>
        </div>

        <input
          value={draft.title}
          onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
          placeholder={t("split.what")}
          className="mt-2 w-full bg-transparent text-center text-[17px] tracking-tight outline-none placeholder:text-muted-foreground/60"
        />
      </div>

      <div className="space-y-6">
        <CurrencyPanel
          lock={lock}
          onCurrencyChange={(currency) =>
            setDraft((prev) => ({ ...prev, currency, currencyConfirmed: true }))
          }
        />

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
                {participants.map((person) => (
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
          scope={draft.groupId ? pari.groupPersonIds(draft.groupId) : []}
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
                  usingGroupDefault: false,
                  ...seedRule(
                    {
                      mode: prev.mode,
                      percentages: prev.percentages,
                      shares: prev.shares,
                      exact: prev.exact,
                    },
                    prev.participants.map((id) => ({ id, name: pari.personName(id) })),
                    mode,
                  ),
                }))
              }
            />
          </div>

          {draft.usingGroupDefault && draft.groupId ? (
            <p className="text-xs text-muted-foreground">
              {t("split.usingGroupDefault", {
                group: pari.data.groups.find((g) => g.id === draft.groupId)?.name ?? "",
              })}
            </p>
          ) : null}

          <SplitRuleEditor
            rule={rule}
            people={participants}
            totalMinor={draft.amountMinor}
            onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
          />
        </section>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center bg-gradient-to-t from-background via-background to-transparent pb-8 pt-10">
        <div className="pointer-events-auto w-full max-w-[430px] px-5">
          <PrimaryButton onClick={() => void save()} disabled={!canSave || busy}>
            {t("split.finish")}
            {draft.amountMinor > 0
              ? ` · ${formatMinorIn(draft.amountMinor, draft.currency, { compact: false })}`
              : ""}
          </PrimaryButton>
        </div>
      </div>
    </Screen>
  );
}
