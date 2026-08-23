import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Receipt as ReceiptIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Divider, Panel, Screen } from "@/components/pari/AppShell";
import { FlowHeader } from "@/components/pari/FlowHeader";
import { PrimaryButton, SecondaryButton } from "@/components/pari/Buttons";
import { EmptyState } from "@/components/pari/EmptyState";
import { NumericField } from "@/components/pari/NumericField";
import { ParticipantSelector } from "@/components/pari/ParticipantSelector";
import { GroupPicker } from "@/components/pari/GroupPicker";
import { SplitSelector } from "@/components/pari/SplitSelector";
import {
  SplitRuleEditor,
  isRuleComplete,
  previewAllocations,
  seedRule,
  type SplitRule,
} from "@/components/pari/SplitRuleEditor";
import { BottomSheet } from "@/components/pari/BottomSheet";
import { FxSummary } from "@/components/pari/FxSummary";
import { ExpenseHistory } from "@/components/pari/ExpenseHistory";
import { ReceiptSheet, type ReceiptSummary } from "@/components/pari/ReceiptSheet";
import { getExpenseReceipt } from "@/lib/receipt.functions";

import { usePari } from "@/data/store";
import type { Allocation, SplitMode } from "@/lib/split";
import { formatMinorIn, toMajor, toMinor } from "@/lib/money";
import { CurrencyPanel } from "@/components/pari/CurrencyPanel";
import { useMoneyLock } from "@/hooks/useMoneyLock";
import { shortDate } from "@/lib/dates";
import { useT } from "@/lib/i18n";
import { AuthGate } from "@/components/pari/AuthGate";

export const Route = createFileRoute("/expense/$expenseId")({
  head: () => ({
    meta: [
      { title: "Expense — PARI" },
      { name: "description", content: "Every detail of a shared expense — and who owes what." },
      { property: "og:title", content: "Expense — PARI" },
      {
        property: "og:description",
        content: "Every detail of a shared expense — and who owes what.",
      },
    ],
  }),
  component: () => (
    <AuthGate>
      <ExpenseDetailScreen />
    </AuthGate>
  ),
});

/** Reads the saved split back into the shared rule shape used by the create flow. */
function ruleFromAllocations(allocations: Allocation[], totalMinor: number): SplitRule {
  const percentages: Record<string, number> = {};
  const shares: Record<string, number> = {};
  const exact: Record<string, number> = {};
  for (const allocation of allocations) {
    if (allocation.percentage != null) percentages[allocation.personId] = allocation.percentage;
    if (allocation.shares != null) shares[allocation.personId] = allocation.shares;
    exact[allocation.personId] = allocation.amountMinor;
  }

  let mode: SplitMode = "equal";
  if (allocations.length > 0 && allocations.every((a) => a.percentage != null)) {
    mode = "percentage";
  } else if (allocations.length > 0 && allocations.every((a) => a.shares != null)) {
    mode = "shares";
  } else if (allocations.length > 0) {
    const each = Math.floor(totalMinor / allocations.length);
    const uniform = allocations.every((a) => Math.abs(a.amountMinor - each) <= 1);
    mode = uniform ? "equal" : "exact";
  }

  return { mode, percentages, shares, exact };
}

function ExpenseDetailScreen() {
  const { expenseId } = Route.useParams();
  const pari = usePari();
  const t = useT();
  const navigate = useNavigate();

  const expense = pari.expenseById(expenseId);
  // Shown and edited in the original currency; converted values are derived on save.
  const allocations = pari.expenseOriginalAllocations(expenseId);
  const items = pari.expenseItems(expenseId);

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Owner-only: RLS decides whether a receipt row comes back at all.
  const [receipt, setReceipt] = useState<ReceiptSummary | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [confirmSettled, setConfirmSettled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(expense?.title ?? "");
  const originalCurrency = expense?.original_currency ?? expense?.currency ?? pari.currency;
  const originalTotalMinor = expense?.original_total_minor ?? expense?.total_minor ?? 0;
  const [currency, setCurrency] = useState(originalCurrency);
  const [amount, setAmount] = useState(toMajor(originalTotalMinor));
  const [paidBy, setPaidBy] = useState(expense?.paid_by_person_id ?? "");
  const [groupId, setGroupId] = useState<string | null>(expense?.group_id ?? null);
  const [groupChanged, setGroupChanged] = useState(false);
  const [participants, setParticipants] = useState<string[]>(
    allocations.map((allocation) => allocation.personId),
  );
  const [rule, setRule] = useState<SplitRule>(() =>
    ruleFromAllocations(allocations, originalTotalMinor),
  );

  // Editing happens in the currency the money was actually spent in.
  const lock = useMoneyLock({
    currency,
    systemCurrency: pari.currency,
    totalMinor: toMinor(amount),
    dateIso: expense?.expense_date ?? null,
    // Existing expense: reuse the rate locked at save time, never refetch.
    stored:
      expense && expense.original_currency && expense.original_currency !== expense.currency
        ? {
            currency: expense.original_currency,
            rate: Number(expense.exchange_rate) || 1,
            rateDate: expense.exchange_rate_date ?? null,
            source: expense.exchange_rate_source,
            cardMinor: expense.card_charged_minor ?? null,
          }
        : null,
  });

  const candidates = useMemo(() => {
    const ids = groupId
      ? pari.groupPersonIds(groupId)
      : pari.data.people.map((person) => person.id);
    return ids.map((id) => ({ id, name: pari.personName(id) }));
  }, [groupId, pari]);

  if (!expense) {
    return (
      <Screen>
        <FlowHeader title={t("expense.title")} />
        <EmptyState title={t("expense.gone")} />
      </Screen>
    );
  }

  const group = expense.group_id
    ? pari.data.groups.find((g) => g.id === expense.group_id)
    : undefined;

  /** The expense is historical once its group already has a completed settlement. */
  const inSettlement =
    expense.group_id != null &&
    pari.data.settlements.some((s) => s.group_id === expense.group_id && s.status === "settled");

  const people = participants.map((id) => ({ id, name: pari.personName(id) }));
  const totalMinor = toMinor(amount);
  const canSave =
    totalMinor > 0 && participants.length > 0 && isRuleComplete(rule, people, totalMinor);

  const startEditing = () => {
    setTitle(expense.title);
    setAmount(toMajor(originalTotalMinor));
    setCurrency(originalCurrency);
    setPaidBy(expense.paid_by_person_id);
    setGroupId(expense.group_id);
    setGroupChanged(false);
    setParticipants(allocations.map((a) => a.personId));
    setRule(ruleFromAllocations(allocations, originalTotalMinor));
    if (inSettlement) setConfirmSettled(true);
    else setEditing(true);
  };

  // Switching group loads that group's members and its saved default rule.
  const changeGroup = (nextGroupId: string | null) => {
    if (nextGroupId === groupId) return;
    const ids = nextGroupId ? pari.groupPersonIds(nextGroupId) : participants;
    const groupDefault = nextGroupId ? pari.groupRule(nextGroupId) : null;
    setGroupId(nextGroupId);
    setGroupChanged(nextGroupId !== expense.group_id);
    setParticipants(ids);
    setPaidBy((prev) => (ids.includes(prev) ? prev : (ids[0] ?? prev)));
    setRule(
      seedRule(
        {
          mode: groupDefault?.mode ?? "equal",
          percentages: groupDefault?.percentages ?? {},
          shares: groupDefault?.shares ?? {},
          exact: {},
        },
        ids.map((id) => ({ id, name: pari.personName(id) })),
        groupDefault?.mode ?? "equal",
      ),
    );
  };

  const toggleParticipant = (personId: string) => {
    const next = participants.includes(personId)
      ? participants.filter((id) => id !== personId)
      : [...participants, personId];
    setParticipants(next);
    setRule((prev) =>
      seedRule(
        prev,
        next.map((id) => ({ id, name: pari.personName(id) })),
        prev.mode,
      ),
    );
  };

  const save = async () => {
    if (busy || !canSave) return;
    setBusy(true);
    try {
      await pari.updateExpense(expense.id, {
        title: title.trim() || expense.title,
        totalMinor,
        paidByPersonId: paidBy,
        groupId,
        allocations: previewAllocations(rule, people, totalMinor),
        ...(lock.money ? { money: lock.money } : {}),
      });
      setEditing(false);
      toast.success(t("expense.saved"));
    } catch {
      toast.error(t("common.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    await pari.deleteExpense(expense.id);
    setBusy(false);
    toast.success(t("expense.deleted"));
    navigate({ to: "/home" });
  };

  return (
    <Screen className="pb-32">
      <FlowHeader title={expense.title} subtitle={group?.name ?? undefined} />

      <div className="px-1 pb-8 text-center">
        <p className="tnum text-[40px] font-semibold tracking-[-0.04em]">
          {formatMinorIn(originalTotalMinor, originalCurrency, { compact: false })}
        </p>
        {originalCurrency !== expense.currency ? (
          <FxSummary
            alignment="center"
            className="mt-1"
            originalCurrency={originalCurrency}
            convertedMinor={expense.total_minor}
            systemCurrency={expense.currency}
            rate={Number(expense.exchange_rate ?? 1)}
            rateDate={expense.exchange_rate_date ?? null}
            fallbackDate={expense.created_at}
          />
        ) : null}
        <p className="mt-2 text-sm text-muted-foreground">
          {shortDate(expense.expense_date)} ·{" "}
          {t("home.paidBy", { name: pari.personName(expense.paid_by_person_id) })}
        </p>
      </div>

      {editing ? (
        <div className="space-y-8">
          <section className="space-y-3">
            <label htmlFor="expense-title" className="block px-1 text-[13px] text-muted-foreground">
              {t("split.what")}
            </label>
            <input
              id="expense-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="h-14 w-full rounded-2xl bg-surface px-4 text-[15px] outline-none ring-accent/40 focus:ring-2"
            />
          </section>

          <section className="space-y-3">
            <span className="block px-1 text-[13px] text-muted-foreground">
              {t("split.amount")}
            </span>
            <NumericField
              value={amount}
              onChange={setAmount}
              min={0}
              ariaLabel={t("split.amount")}
              inputClassName="h-14 w-full rounded-2xl bg-surface px-4 text-[15px]"
            />
          </section>

          {pari.data.groups.length > 0 ? (
            <section className="space-y-2">
              <GroupPicker groupId={groupId} onChange={changeGroup} />
              {groupChanged ? (
                <p className="px-1 text-xs text-muted-foreground">
                  {t("expense.groupChangeWarning")}
                </p>
              ) : null}
            </section>
          ) : null}

          <ParticipantSelector
            label={t("split.splitBetween")}
            people={candidates}
            selected={participants}
            onToggle={toggleParticipant}
            onSelectAll={() => {
              const next =
                participants.length === candidates.length ? [] : candidates.map((p) => p.id);
              setParticipants(next);
              setRule((prev) =>
                seedRule(
                  prev,
                  next.map((id) => ({ id, name: pari.personName(id) })),
                  prev.mode,
                ),
              );
            }}
          />

          <section className="space-y-3">
            <h3 className="px-1 text-[15px] font-medium tracking-tight">{t("split.paidBy")}</h3>
            <Panel>
              {candidates.map((person, index) => (
                <div key={person.id}>
                  {index > 0 ? <Divider /> : null}
                  <button
                    type="button"
                    onClick={() => setPaidBy(person.id)}
                    className="flex w-full items-center justify-between px-4 py-4 text-left text-[15px]"
                  >
                    {person.name}
                    {paidBy === person.id ? (
                      <span className="text-sm text-accent-foreground">✓</span>
                    ) : null}
                  </button>
                </div>
              ))}
            </Panel>
          </section>

          <CurrencyPanel lock={lock} onCurrencyChange={setCurrency} />

          <section className="space-y-4 rounded-3xl bg-surface p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-muted-foreground">{t("split.distribution")}</p>
              <SplitSelector
                mode={rule.mode}
                onChange={(mode) => setRule((prev) => seedRule(prev, people, mode))}
              />
            </div>
            <SplitRuleEditor
              rule={rule}
              people={people}
              totalMinor={totalMinor}
              currency={currency}
              onChange={(patch) => setRule((prev) => ({ ...prev, ...patch }))}
            />
          </section>

          <div className="space-y-2">
            <PrimaryButton onClick={() => void save()} disabled={busy || !canSave}>
              {t("expense.saveChanges")}
            </PrimaryButton>
            <SecondaryButton onClick={() => setEditing(false)} disabled={busy}>
              {t("common.cancel")}
            </SecondaryButton>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <Panel title={t("expense.split")}>
            {allocations.map((allocation, index) => (
              <div key={allocation.personId}>
                {index > 0 ? <Divider /> : null}
                <div className="flex items-center justify-between px-4 py-4 text-[15px]">
                  <span>
                    {pari.personName(allocation.personId)}
                    {allocation.percentage != null ? (
                      <span className="ml-2 text-[13px] text-muted-foreground">
                        {allocation.percentage}%
                      </span>
                    ) : null}
                  </span>
                  <span className="tnum text-[15px] font-medium">
                    {formatMinorIn(allocation.amountMinor, originalCurrency)}
                  </span>
                </div>
              </div>
            ))}
          </Panel>

          {items.length > 0 ? (
            <Panel title={t("expense.receiptItems")}>
              {items.map((item, index) => (
                <div key={item.id}>
                  {index > 0 ? <Divider /> : null}
                  <div className="flex items-center justify-between px-4 py-3.5 text-[15px]">
                    <span className="truncate">
                      {item.quantity > 1 ? `${item.quantity} × ` : ""}
                      {item.name}
                    </span>
                    <span className="tnum text-sm text-muted-foreground">
                      {formatMinorIn(item.total_minor, originalCurrency)}
                    </span>
                  </div>
                </div>
              ))}
            </Panel>
          ) : null}

          {receipt ? (
            <div>
              <SecondaryButton onClick={() => setReceiptOpen(true)}>
                <ReceiptIcon className="h-4 w-4" strokeWidth={1.8} />
                {t("receipt.view")}
              </SecondaryButton>
            </div>
          ) : null}

          <ExpenseHistory expenseId={expense.id} />

          <div className="space-y-2">

            <PrimaryButton onClick={startEditing}>{t("common.edit")}</PrimaryButton>
            <SecondaryButton onClick={() => setConfirmDelete(true)} className="text-negative">
              <Trash2 className="h-4 w-4" strokeWidth={1.8} />
              {t("common.delete")}
            </SecondaryButton>
          </div>
        </div>
      )}

      {receipt ? (
        <ReceiptSheet
          open={receiptOpen}
          onClose={() => setReceiptOpen(false)}
          receipt={receipt}
        />
      ) : null}

      <BottomSheet open={confirmSettled} onClose={() => setConfirmSettled(false)}>
        <div className="space-y-5 px-1">
          <div>
            <h2 className="text-[19px] font-semibold tracking-tight">
              {t("expense.settledWarning")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("expense.settledHint")}</p>
          </div>
          <div className="space-y-2">
            <PrimaryButton
              onClick={() => {
                setConfirmSettled(false);
                setEditing(true);
              }}
            >
              {t("expense.editAnyway")}
            </PrimaryButton>
            <SecondaryButton onClick={() => setConfirmSettled(false)}>
              {t("common.cancel")}
            </SecondaryButton>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <div className="space-y-5 px-1">
          <div>
            <h2 className="text-[19px] font-semibold tracking-tight">
              {t("expense.deleteConfirm")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("expense.deleteHint")}</p>
          </div>
          <div className="space-y-2">
            <PrimaryButton onClick={remove} disabled={busy}>
              {t("common.delete")}
            </PrimaryButton>
            <SecondaryButton onClick={() => setConfirmDelete(false)} disabled={busy}>
              {t("common.cancel")}
            </SecondaryButton>
          </div>
        </div>
      </BottomSheet>
    </Screen>
  );
}
