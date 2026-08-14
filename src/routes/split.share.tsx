import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Screen } from "@/components/pari/AppShell";
import { FlowHeader } from "@/components/pari/FlowHeader";
import { PrimaryButton, SecondaryButton } from "@/components/pari/Buttons";
import { GroupPicker } from "@/components/pari/GroupPicker";
import { ParticipantPicker } from "@/components/pari/ParticipantPicker";
import { SplitRuleEditor, isRuleComplete, seedRule } from "@/components/pari/SplitRuleEditor";
import { SplitSelector } from "@/components/pari/SplitSelector";
import { computeDraftAllocations, draftSharedTotalMinor, sharedItems } from "@/data/draft";
import { usePari } from "@/data/store";
import { useT } from "@/lib/i18n";
import { formatMinor } from "@/lib/money";

export const Route = createFileRoute("/split/share")({
  head: () => ({
    meta: [
      { title: "Share the receipt — PARI" },
      { name: "description", content: "Split the whole receipt by any rule, or go item by item." },
      { property: "og:title", content: "Share the receipt — PARI" },
      {
        property: "og:description",
        content: "Split the whole receipt by any rule, or go item by item.",
      },
    ],
  }),
  component: ShareScreen,
});

function ShareScreen() {
  const pari = usePari();
  const t = useT();
  const navigate = useNavigate();
  const { draft, setDraft } = pari;

  const showGroups = !pari.isGuest && pari.data.groups.length > 0;

  const wholeReceipt = { ...draft, splitByItem: false };
  const sharedTotal = draftSharedTotalMinor(wholeReceipt);
  const allocations = computeDraftAllocations(wholeReceipt);
  const partial = draft.items.length > 0 && sharedItems(draft.items).length < draft.items.length;

  const participants = draft.participants.map((id) => ({ id, name: pari.personName(id) }));
  const rule = {
    mode: draft.mode,
    percentages: draft.percentages,
    shares: draft.shares,
    exact: draft.exact,
  };

  const setGroup = (groupId: string | null) => {
    const groupDefault = groupId ? pari.groupRule(groupId) : null;
    const ids = groupId ? pari.groupPersonIds(groupId) : [pari.currentPersonId];
    setDraft((prev) => ({
      ...prev,
      groupId,
      participants: ids,
      mode: groupDefault?.mode ?? "equal",
      percentages: groupDefault?.percentages ?? {},
      shares: groupDefault?.shares ?? {},
      exact: {},
      usingGroupDefault: Boolean(groupDefault) && groupDefault?.mode !== "equal",
    }));
  };

  const confirm = async () => {
    const expense = await pari.addExpense({
      groupId: draft.groupId,
      title: draft.title || draft.merchant || "Receipt",
      merchant: draft.merchant,
      paidByPersonId: draft.paidByPersonId,
      totalMinor: sharedTotal,
      allocations,
      source: "receipt",
      items: draft.items,
    });
    if (!expense) return;
    navigate({ to: "/split/result", search: { expenseId: expense.id } });
  };

  const goItemised = () => {
    setDraft((prev) => ({ ...prev, splitByItem: true }));
    navigate({ to: "/split/items" });
  };

  return (
    <Screen className="pb-44">
      <FlowHeader title={draft.merchant ?? t("split.receipt")} />

      <div className="px-1 pb-8">
        <h1 className="text-[26px] font-semibold leading-[1.2] tracking-[-0.03em]">
          {t("split.receiptShareTitle")}
        </h1>
        {partial ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {t("split.sharingPartial", {
              shared: sharedItems(draft.items).length,
              total: draft.items.length,
              amount: formatMinor(sharedTotal, { compact: false }),
            })}
          </p>
        ) : null}
      </div>

      <div className="space-y-7">
        {showGroups ? <GroupPicker groupId={draft.groupId} onChange={setGroup} /> : null}

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
                  splitByItem: false,
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
              {...(draft.items.length > 0
                ? { itemized: { active: false, onSelect: goItemised } }
                : {})}
            />
          </div>

          <p className="text-sm text-muted-foreground">
            {formatMinor(sharedTotal, { compact: false })} ·{" "}
            {t(
              draft.participants.length === 1
                ? "participants.personCount"
                : "participants.peopleCount",
              { count: draft.participants.length },
            )}
          </p>

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
            totalMinor={sharedTotal}
            onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
          />
        </section>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center bg-gradient-to-t from-background via-background to-transparent pb-8 pt-10">
        <div className="pointer-events-auto w-full max-w-[430px] space-y-2 px-5">
          <PrimaryButton
            onClick={confirm}
            disabled={
              draft.participants.length === 0 || !isRuleComplete(rule, participants, sharedTotal)
            }
          >
            {t("receipt.confirmSplit")}
          </PrimaryButton>
          {draft.items.length > 0 ? (
            <SecondaryButton onClick={goItemised}>{t("split.splitByItem")}</SecondaryButton>
          ) : null}
        </div>
      </div>
    </Screen>
  );
}
