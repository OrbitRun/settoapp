import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Pencil, Trash2 } from "lucide-react";

import { Screen } from "@/components/pari/AppShell";
import { FlowHeader } from "@/components/pari/FlowHeader";
import { BottomSheet } from "@/components/pari/BottomSheet";
import { PrimaryButton, SecondaryButton } from "@/components/pari/Buttons";
import { ReceiptItemRow } from "@/components/pari/ReceiptItem";
import { itemTotalMinor, itemsTotalMinor, type DraftItem } from "@/data/draft";
import { usePari } from "@/data/store";
import { formatMinor, parseAmountToMinor, toMajor } from "@/lib/money";
import { shortDate } from "@/lib/dates";

export const Route = createFileRoute("/split/review")({
  head: () => ({
    meta: [
      { title: "Check the receipt — PARI" },
      { name: "description", content: "Edit any line before you share it with anyone." },
      { property: "og:title", content: "Check the receipt — PARI" },
      { property: "og:description", content: "Edit any line before you share it with anyone." },
    ],
  }),
  component: ReviewScreen,
});

function ReviewScreen() {
  const pari = usePari();
  const navigate = useNavigate();
  const { draft, setDraft } = pari;
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<DraftItem | null>(null);

  const itemsTotal = itemsTotalMinor(draft.items);
  const difference = draft.amountMinor - itemsTotal;

  const update = (id: string, patch: Partial<DraftItem>) =>
    setDraft((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));

  const remove = (id: string) =>
    setDraft((prev) => ({ ...prev, items: prev.items.filter((item) => item.id !== id) }));

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const markPrivate = () => {
    setDraft((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        selected.includes(item.id) ? { ...item, isShared: false } : item,
      ),
    }));
    setSelected([]);
  };

  const shareSelected = () => {
    setDraft((prev) => ({
      ...prev,
      items: prev.items.map((item) => ({ ...item, isShared: selected.includes(item.id) })),
      splitByItem: false,
    }));
    setSelected([]);
    navigate({ to: "/split/share" });
  };

  return (
    <Screen className="pb-44">
      <FlowHeader title="Receipt found" />

      <div className="px-1 pb-8">
        <p className="text-sm text-muted-foreground">{shortDate(draft.items.length ? new Date().toISOString() : new Date().toISOString())}</p>
        <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.03em]">
          {draft.merchant ?? "Receipt"}
        </h1>
        <p className="tnum mt-2 text-[17px] text-muted-foreground">
          {formatMinor(draft.amountMinor, { compact: false })}
        </p>
      </div>

      <div className="rounded-3xl bg-surface p-1.5 shadow-soft">
        {draft.items.map((item) => (
          <ReceiptItemRow
            key={item.id}
            name={item.name}
            amountMinor={item.unitPriceMinor}
            quantity={item.quantity}
            selectable
            selected={selected.includes(item.id)}
            isPrivate={!item.isShared}
            onClick={() => toggle(item.id)}
            right={
              <span className="flex items-center gap-3">
                <span className="tnum">
                  {formatMinor(itemTotalMinor(item), { currency: "" }).trim()}
                </span>
                <button
                  type="button"
                  aria-label={`Edit ${item.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setEditing(item);
                  }}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" strokeWidth={1.6} />
                </button>
              </span>
            }
          />
        ))}
      </div>

      <div className="mt-5 space-y-2 px-4">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Detected items</span>
          <span className="tnum">{formatMinor(itemsTotal, { compact: false })}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Receipt total</span>
          <span className="tnum font-medium">
            {formatMinor(draft.amountMinor, { compact: false })}
          </span>
        </div>
        <p className="pt-1 text-sm">
          {difference === 0 ? (
            <span className="inline-flex items-center gap-1.5 text-positive">
              <Check className="h-4 w-4" strokeWidth={2} /> Looks good
            </span>
          ) : (
            <span className="text-muted-foreground">
              {difference > 0
                ? `We're missing ${formatMinor(difference, { compact: false })}`
                : `That's ${formatMinor(-difference, { compact: false })} too much`}
            </span>
          )}
        </p>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center bg-gradient-to-t from-background via-background to-transparent pb-8 pt-10">
        <div className="pointer-events-auto w-full max-w-[430px] space-y-2 px-5">
          {selected.length > 0 ? (
            <>
              <p className="pb-1 text-center text-sm text-muted-foreground">
                {selected.length} {selected.length === 1 ? "item" : "items"} selected
              </p>
              <PrimaryButton onClick={shareSelected}>Share selected</PrimaryButton>
              <SecondaryButton onClick={markPrivate}>Keep private</SecondaryButton>
            </>
          ) : (
            <PrimaryButton onClick={() => navigate({ to: "/split/share" })}>
              Continue
            </PrimaryButton>
          )}
        </div>
      </div>

      <BottomSheet open={editing !== null} onClose={() => setEditing(null)} title="Edit item">
        {editing ? (
          <div className="space-y-4">
            <input
              value={editing.name}
              onChange={(event) => setEditing({ ...editing, name: event.target.value })}
              className="w-full rounded-2xl bg-surface-strong px-4 py-3.5 text-[15px] outline-none"
              aria-label="Item name"
            />
            <div className="flex gap-2">
              <div className="flex h-12 flex-1 items-center rounded-2xl bg-surface-strong px-4">
                <input
                  inputMode="decimal"
                  aria-label="Price"
                  value={String(toMajor(editing.unitPriceMinor))}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      unitPriceMinor: parseAmountToMinor(event.target.value),
                    })
                  }
                  className="tnum w-full bg-transparent text-[15px] outline-none"
                />
                <span className="text-xs text-muted-foreground">DKK</span>
              </div>
              <div className="flex h-12 w-28 items-center rounded-2xl bg-surface-strong px-4">
                <input
                  inputMode="numeric"
                  aria-label="Quantity"
                  value={String(editing.quantity)}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      quantity: Math.max(1, Number(event.target.value) || 1),
                    })
                  }
                  className="tnum w-full bg-transparent text-[15px] outline-none"
                />
                <span className="text-xs text-muted-foreground">qty</span>
              </div>
            </div>

            <PrimaryButton
              onClick={() => {
                update(editing.id, editing);
                setEditing(null);
              }}
            >
              Save
            </PrimaryButton>
            <button
              type="button"
              onClick={() => {
                remove(editing.id);
                setEditing(null);
              }}
              className="mx-auto flex items-center gap-2 py-2 text-sm text-muted-foreground transition-colors hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.6} />
              Delete item
            </button>
          </div>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}
