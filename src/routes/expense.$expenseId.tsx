import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Divider, Panel, Screen } from "@/components/pari/AppShell";
import { FlowHeader } from "@/components/pari/FlowHeader";
import { PrimaryButton, SecondaryButton } from "@/components/pari/Buttons";
import { EmptyState } from "@/components/pari/EmptyState";
import { MoneyAmount } from "@/components/pari/MoneyAmount";
import { NumericField } from "@/components/pari/NumericField";
import { ParticipantSelector } from "@/components/pari/ParticipantSelector";
import { BottomSheet } from "@/components/pari/BottomSheet";
import { usePari } from "@/data/store";
import { calculateEqualSplit } from "@/lib/split";
import { toMajor, toMinor } from "@/lib/money";
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

function ExpenseDetailScreen() {
  const { expenseId } = Route.useParams();
  const pari = usePari();
  const t = useT();
  const navigate = useNavigate();

  const expense = pari.expenseById(expenseId);
  const allocations = pari.expenseAllocations(expenseId);
  const items = pari.expenseItems(expenseId);

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(expense?.title ?? "");
  const [amount, setAmount] = useState(toMajor(expense?.total_minor ?? 0));
  const [paidBy, setPaidBy] = useState(expense?.paid_by_person_id ?? "");
  const [participants, setParticipants] = useState<string[]>(
    allocations.map((allocation) => allocation.personId),
  );

  const candidates = useMemo(() => {
    const ids = expense?.group_id
      ? pari.groupPersonIds(expense.group_id)
      : pari.data.people.map((person) => person.id);
    return ids.map((id) => ({ id, name: pari.personName(id) }));
  }, [expense?.group_id, pari]);

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

  const save = async () => {
    setBusy(true);
    const totalMinor = toMinor(amount);
    await pari.updateExpense(expense.id, {
      title: title.trim() || expense.title,
      totalMinor,
      paidByPersonId: paidBy,
      allocations: calculateEqualSplit(totalMinor, participants),
    });
    setBusy(false);
    setEditing(false);
    toast.success(t("expense.saved"));
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
      <FlowHeader
        title={expense.title}
        subtitle={group?.name ?? undefined}
      />

      <div className="px-1 pb-8 text-center">
        <MoneyAmount
          minor={expense.total_minor}
          className="text-[40px] font-semibold tracking-[-0.04em]"
        />
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

          <ParticipantSelector
            label={t("split.splitBetween")}
            people={candidates}
            selected={participants}
            onToggle={(personId) =>
              setParticipants((prev) =>
                prev.includes(personId)
                  ? prev.filter((id) => id !== personId)
                  : [...prev, personId],
              )
            }
            onSelectAll={() =>
              setParticipants((prev) =>
                prev.length === candidates.length ? [] : candidates.map((p) => p.id),
              )
            }
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

          <div className="space-y-2">
            <PrimaryButton onClick={save} disabled={busy || participants.length === 0}>
              {t("common.save")}
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
                  <span>{pari.personName(allocation.personId)}</span>
                  <MoneyAmount minor={allocation.amountMinor} />
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
                    <MoneyAmount minor={item.total_minor} tone="muted" />
                  </div>
                </div>
              ))}
            </Panel>
          ) : null}

          <div className="space-y-2">
            <PrimaryButton onClick={() => setEditing(true)}>{t("common.edit")}</PrimaryButton>
            <SecondaryButton onClick={() => setConfirmDelete(true)} className="text-negative">
              <Trash2 className="h-4 w-4" strokeWidth={1.8} />
              {t("common.delete")}
            </SecondaryButton>
          </div>
        </div>
      )}

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
