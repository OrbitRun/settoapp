import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";

import { Screen } from "@/components/pari/AppShell";
import { FlowHeader } from "@/components/pari/FlowHeader";
import { PrimaryButton, SecondaryButton } from "@/components/pari/Buttons";
import { GroupPicker } from "@/components/pari/GroupPicker";
import { ParticipantSelector } from "@/components/pari/ParticipantSelector";
import { computeDraftAllocations, draftSharedTotalMinor, sharedItems } from "@/data/draft";
import { usePari } from "@/data/store";
import { useT } from "@/lib/i18n";
import { formatMinor } from "@/lib/money";

export const Route = createFileRoute("/split/share")({
  head: () => ({
    meta: [
      { title: "Share the receipt — PARI" },
      { name: "description", content: "Split it equally in one tap, or go item by item." },
      { property: "og:title", content: "Share the receipt — PARI" },
      { property: "og:description", content: "Split it equally in one tap, or go item by item." },
    ],
  }),
  component: ShareScreen,
});

function ShareScreen() {
  const pari = usePari();
  const t = useT();
  const navigate = useNavigate();
  const { draft, setDraft } = pari;

  const people = useMemo(() => {
    const ids = draft.groupId
      ? pari.groupPersonIds(draft.groupId)
      : pari.data.people.map((p) => p.id);
    return ids.map((id) => ({ id, name: pari.personName(id) }));
  }, [draft.groupId, pari]);

  const sharedTotal = draftSharedTotalMinor({ ...draft, splitByItem: false });
  const allocations = computeDraftAllocations({ ...draft, splitByItem: false, mode: "equal" });
  const perPerson = allocations[0]?.amountMinor ?? 0;
  const partial = draft.items.length > 0 && sharedItems(draft.items).length < draft.items.length;

  const setGroup = (groupId: string | null) => {
    const ids = groupId ? pari.groupPersonIds(groupId) : [pari.currentPersonId];
    setDraft((prev) => ({ ...prev, groupId, participants: ids }));
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

  return (
    <Screen className="pb-44">
      <FlowHeader title={draft.merchant ?? t("split.receipt")} />

      <div className="px-1 pb-8">
        <h1 className="text-[26px] font-semibold leading-[1.2] tracking-[-0.03em]">
          How should this receipt be shared?
        </h1>
        {partial ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Sharing {sharedItems(draft.items).length} of {draft.items.length} items ·{" "}
            {formatMinor(sharedTotal, { compact: false })}. The rest stays private.
          </p>
        ) : null}
      </div>

      <div className="space-y-7">
        <GroupPicker groupId={draft.groupId} onChange={setGroup} />

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

        <section className="rounded-3xl bg-surface px-5 py-7 text-center shadow-soft">
          <p className="text-sm text-muted-foreground">
            {formatMinor(sharedTotal, { compact: false })} · {draft.participants.length}{" "}
            {draft.participants.length === 1 ? "person" : "people"}
          </p>
          <p className="mt-3 text-[34px] font-semibold tracking-[-0.035em]">
            {formatMinor(perPerson, { compact: false })}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">each</p>
        </section>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center bg-gradient-to-t from-background via-background to-transparent pb-8 pt-10">
        <div className="pointer-events-auto w-full max-w-[430px] space-y-2 px-5">
          <PrimaryButton onClick={confirm} disabled={draft.participants.length === 0}>
            Confirm split
          </PrimaryButton>
          {draft.items.length > 0 ? (
            <SecondaryButton
              onClick={() => {
                setDraft((prev) => ({ ...prev, splitByItem: true }));
                navigate({ to: "/split/items" });
              }}
            >
              Split by item
            </SecondaryButton>
          ) : null}
        </div>
      </div>
    </Screen>
  );
}
