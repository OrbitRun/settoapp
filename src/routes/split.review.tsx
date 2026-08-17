import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Pencil, Trash2 } from "lucide-react";

import { Screen } from "@/components/pari/AppShell";
import { FlowHeader } from "@/components/pari/FlowHeader";
import { BottomSheet } from "@/components/pari/BottomSheet";
import { PrimaryButton, SecondaryButton } from "@/components/pari/Buttons";
import { ReceiptItemRow } from "@/components/pari/ReceiptItem";
import {
  draftItemsNetTotalMinor,
  itemOriginalTotalMinor,
  itemTotalMinor,
  itemsTotalMinor,
  type DraftItem,
} from "@/data/draft";

import { usePari } from "@/data/store";
import { CurrencyPanel } from "@/components/pari/CurrencyPanel";
import { useMoneyLock } from "@/hooks/useMoneyLock";
import { currencyLabel, formatMinorIn, toMajor, toMinor } from "@/lib/money";
import { NumericField } from "@/components/pari/NumericField";
import { shortDate } from "@/lib/dates";
import { useT } from "@/lib/i18n";

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

/** Keeps original / discount / paid consistent on a line, in whole øre. */
function withMoney(
  item: DraftItem,
  originalLineMinor: number,
  discountLineMinor: number,
): DraftItem {
  const quantity = Math.max(1, item.quantity);
  const discount = Math.min(Math.max(0, discountLineMinor), originalLineMinor);
  const paid = originalLineMinor - discount;
  return {
    ...item,
    unitPriceMinor: Math.round(paid / quantity),
    originalUnitPriceMinor: discount > 0 ? Math.round(originalLineMinor / quantity) : null,
    discountMinor: discount,
    discountPercent: null,
  };
}

function ReviewScreen() {
  const pari = usePari();
  const navigate = useNavigate();
  const { draft, setDraft } = pari;
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<DraftItem | null>(null);
  const t = useT();

  // The review screen stays entirely in the receipt's own currency.
  const money = (minor: number, options: { currency?: string; compact?: boolean } = {}) =>
    formatMinorIn(minor, options.currency ?? draft.currency, {
      compact: options.compact ?? true,
    });

  const lock = useMoneyLock({
    currency: draft.currency,
    systemCurrency: pari.currency,
    totalMinor: draft.amountMinor,
    dateIso: draft.dateIso ?? null,
  });

  const grossTotal = itemsTotalMinor(draft.items);
  const receiptDiscount = draft.receiptDiscountMinor ?? 0;
  const itemsTotal = draftItemsNetTotalMinor(draft);
  const rawDifference = draft.amountMinor - itemsTotal;
  // Whole-øre rounding noise is not a mismatch.
  const difference = Math.abs(rawDifference) <= 1 ? 0 : rawDifference;
  const unassignedDiscount = (draft.receiptWarnings ?? []).includes("UNASSIGNED_DISCOUNT");
  const unsureLines = draft.items.filter((item) => item.confidence === "low").length;

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
    <Screen className="pb-[calc(15rem+env(safe-area-inset-bottom))]">
      <FlowHeader title={t("receipt.found")} />

      <div className="px-1 pb-8">
        <p className="text-sm text-muted-foreground">
          {shortDate(draft.dateIso ?? new Date().toISOString())}
        </p>
        <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.03em]">
          {draft.merchant ?? t("split.receipt")}
        </h1>
        {(draft.merchantAddress ?? []).length > 0 ? (
          <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
            {(draft.merchantAddress ?? []).join(" · ")}
          </p>
        ) : null}
        <p className="tnum mt-2 text-[17px] text-muted-foreground">
          {money(draft.amountMinor, { compact: false })}
        </p>
      </div>

      <div className="mb-4">
        <CurrencyPanel
          lock={lock}
          onCurrencyChange={(currency) =>
            setDraft((prev) => ({
              ...prev,
              currency,
              currencyConfidence: "high",
              currencyConfirmed: true,
            }))
          }
          detectedNote={
            draft.currencyConfirmed
              ? undefined
              : draft.currencyConfidence === "high"
                ? t("currency.detected")
                : t("currency.inferred")
          }
        />
      </div>

      {unassignedDiscount ? (
        <div className="mb-4 rounded-2xl bg-surface-strong px-4 py-3 text-sm text-muted-foreground">
          {t("receipt.unassignedDiscount", {
            amount: money(receiptDiscount, { compact: false }),
          })}
        </div>
      ) : unsureLines > 0 ? (
        // Money reconciling matters more than legibility: only warn hard when it doesn't.
        <div
          className={`mb-4 rounded-2xl px-4 py-3 text-sm ${
            difference === 0 ? "bg-surface-strong text-muted-foreground" : "bg-warning-soft"
          }`}
        >
          {difference === 0
            ? unsureLines === 1
              ? t("receipt.uncertainName")
              : t("receipt.uncertainNames", { count: unsureLines })
            : t("receipt.lowConfidence")}
        </div>
      ) : draft.receiptWarnings && draft.receiptWarnings.length > 0 ? (
        <div className="mb-4 rounded-2xl bg-surface-strong px-4 py-3 text-sm text-muted-foreground">
          {t("receipt.checkLines")}
        </div>
      ) : null}

      <div className="mb-3 flex items-center justify-between px-4">
        <span className="text-[13px] text-muted-foreground">
          {selected.length > 0
            ? t("receipt.itemsSelected", { count: selected.length })
            : t("receipt.itemCount", { count: draft.items.length })}
        </span>
        <button
          type="button"
          onClick={() =>
            setSelected((prev) =>
              prev.length === draft.items.length ? [] : draft.items.map((item) => item.id),
            )
          }
          className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {selected.length === draft.items.length && draft.items.length > 0
            ? t("common.deselectAll")
            : t("common.selectAll")}
        </button>
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
            flagged={item.confidence === "low"}
            flagLabel={t("receipt.checkLine")}

            detail={
              (item.discountMinor ?? 0) > 0
                ? t("receipt.discountLine", {
                    original: money(itemOriginalTotalMinor(item), {
                      currency: "",
                      compact: false,
                    }).trim(),
                    amount: money(item.discountMinor ?? 0, {
                      currency: "",
                      compact: false,
                    }).trim(),
                  })
                : undefined
            }
            onClick={() => toggle(item.id)}
            right={
              <span className="flex items-center gap-3">
                <span className="tnum">{money(itemTotalMinor(item), { currency: "" }).trim()}</span>
                <button
                  type="button"
                  aria-label={`${t("common.edit")} ${item.name}`}
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
          <span>{t("receipt.detected")}</span>
          <span className="tnum">{money(grossTotal, { compact: false })}</span>
        </div>
        {receiptDiscount > 0 ? (
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{t("receipt.discount")}</span>
            <span className="tnum">−{money(receiptDiscount, { compact: false })}</span>
          </div>
        ) : null}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t("receipt.total")}</span>
          <span className="tnum font-medium">{money(draft.amountMinor, { compact: false })}</span>
        </div>

        <p className="pt-1 text-sm">
          {difference === 0 ? (
            <span className="inline-flex items-center gap-1.5 text-positive">
              <Check className="h-4 w-4" strokeWidth={2} /> {t("receipt.looksGood")}
            </span>
          ) : (
            <span className="text-muted-foreground">
              {difference > 0
                ? t("receipt.missing", { amount: money(difference, { compact: false }) })
                : t("receipt.tooMuch", {
                    amount: money(-difference, { compact: false }),
                  })}
            </span>
          )}
        </p>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center bg-gradient-to-t from-background via-background to-transparent pb-8 pt-10">
        <div className="pointer-events-auto w-full max-w-[430px] space-y-2 px-5">
          {selected.length > 0 ? (
            <>
              <p className="pb-1 text-center text-sm text-muted-foreground">
                {t("receipt.itemsSelected", { count: selected.length })}
              </p>
              <PrimaryButton onClick={shareSelected}>{t("receipt.shareSelected")}</PrimaryButton>
              <SecondaryButton onClick={markPrivate}>{t("receipt.keepPrivate")}</SecondaryButton>
            </>
          ) : (
            <PrimaryButton onClick={() => navigate({ to: "/split/share" })}>
              {t("common.continue")}
            </PrimaryButton>
          )}
        </div>
      </div>

      <BottomSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={t("receipt.editItem")}
      >
        {editing ? (
          <div className="space-y-4">
            <input
              value={editing.name}
              onChange={(event) => setEditing({ ...editing, name: event.target.value })}
              className="w-full rounded-2xl bg-surface-strong px-4 py-3.5 text-[15px] outline-none"
              aria-label={t("receipt.itemName")}
            />
            <div className="flex gap-2">
              <NumericField
                value={toMajor(itemOriginalTotalMinor(editing))}
                onChange={(next) => {
                  const original = Math.max(0, toMinor(next));
                  const discount = Math.min(editing.discountMinor ?? 0, original);
                  setEditing(withMoney(editing, original, discount));
                }}
                min={0}
                ariaLabel={t("receipt.originalPrice")}
                suffix={<span className="text-xs">{currencyLabel(draft.currency)}</span>}
                className="h-12 flex-1 rounded-2xl bg-surface-strong px-4"
                inputClassName="text-[15px]"
              />
              <NumericField
                value={editing.quantity}
                onChange={(next) =>
                  setEditing({ ...editing, quantity: Math.max(1, Math.round(next)) })
                }
                min={1}
                decimals={0}
                ariaLabel={t("receipt.quantity")}
                suffix={<span className="text-xs">{t("receipt.quantityShort")}</span>}
                className="h-12 w-28 rounded-2xl bg-surface-strong px-4"
                inputClassName="text-[15px]"
              />
            </div>

            <div className="flex gap-2">
              <NumericField
                value={toMajor(editing.discountMinor ?? 0)}
                onChange={(next) => {
                  const original = itemOriginalTotalMinor(editing);
                  const discount = Math.min(Math.max(0, toMinor(next)), original);
                  setEditing(withMoney(editing, original, discount));
                }}
                min={0}
                ariaLabel={t("receipt.discount")}
                suffix={<span className="text-xs">{currencyLabel(draft.currency)}</span>}
                className="h-12 flex-1 rounded-2xl bg-surface-strong px-4"
                inputClassName="text-[15px]"
              />
              <NumericField
                value={toMajor(itemTotalMinor(editing))}
                onChange={(next) => {
                  const paid = Math.max(0, toMinor(next));
                  const original = Math.max(itemOriginalTotalMinor(editing), paid);
                  setEditing(withMoney(editing, original, original - paid));
                }}
                min={0}
                ariaLabel={t("receipt.paidPrice")}
                suffix={<span className="text-xs">{currencyLabel(draft.currency)}</span>}
                className="h-12 flex-1 rounded-2xl bg-surface-strong px-4"
                inputClassName="text-[15px]"
              />
            </div>

            <p className="px-1 text-xs text-muted-foreground">
              {t("receipt.originalPrice")} · {t("receipt.discount")} · {t("receipt.paidPrice")}
            </p>

            <PrimaryButton
              onClick={() => {
                update(editing.id, editing);
                setEditing(null);
              }}
            >
              {t("common.save")}
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
              {t("receipt.deleteItem")}
            </button>
          </div>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}
