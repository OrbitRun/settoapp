/**
 * Human-readable expense change history.
 *
 * `diffExpense` compares two snapshots of an expense and produces a structured
 * change set that is stored on the activity row. `describeChanges` turns that
 * change set into localized lines for the UI — database field names never
 * reach the screen.
 */
import type { Allocation, SplitMode } from "@/lib/split";
import { formatMinor, formatMinorIn } from "@/lib/money";
import type { Translate } from "@/lib/i18n";

export type ExpenseSnapshot = {
  title: string;
  /** Total in the currency the money was spent in. */
  totalMinor: number;
  currency: string;
  systemCurrency: string;
  exchangeRate: number;
  payerId: string;
  groupId: string | null;
  allocations: Allocation[];
  items: { name: string; totalMinor: number }[];
};

export type ExpenseChangeSet = {
  title?: { from: string; to: string };
  amount?: { from: number; to: number; currency: string };
  payer?: { from: string; to: string };
  group?: { from: string | null; to: string | null };
  splitMode?: { from: SplitMode; to: SplitMode };
  splitValues?: {
    personId: string;
    fromPercentage?: number;
    toPercentage?: number;
    fromShares?: number;
    toShares?: number;
    fromAmountMinor?: number;
    toAmountMinor?: number;
  }[];
  participantsAdded?: string[];
  participantsRemoved?: string[];
  fx?: { fromRate: number; toRate: number; currency: string; systemCurrency: string };
  items?: {
    added: string[];
    removed: string[];
    changed: { name: string; from: number; to: number }[];
    currency: string;
  };
};

const MODE_KEYS: Record<SplitMode, string> = {
  equal: "split.equal",
  percentage: "split.percentage",
  shares: "split.shares",
  exact: "split.exact",
};

/** Best-effort read of the split mode from stored allocations. */
export function inferSplitMode(allocations: Allocation[], totalMinor: number): SplitMode {
  if (allocations.length === 0) return "equal";
  if (allocations.every((a) => a.percentage != null)) return "percentage";
  if (allocations.every((a) => a.shares != null)) return "shares";
  const each = Math.floor(totalMinor / allocations.length);
  return allocations.every((a) => Math.abs(a.amountMinor - each) <= 1) ? "equal" : "exact";
}

function round(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function diffExpense(before: ExpenseSnapshot, after: ExpenseSnapshot): ExpenseChangeSet {
  const changes: ExpenseChangeSet = {};

  if (before.title !== after.title) changes.title = { from: before.title, to: after.title };
  if (before.totalMinor !== after.totalMinor) {
    changes.amount = { from: before.totalMinor, to: after.totalMinor, currency: after.currency };
  }
  if (before.payerId !== after.payerId) changes.payer = { from: before.payerId, to: after.payerId };
  if (before.groupId !== after.groupId) changes.group = { from: before.groupId, to: after.groupId };

  const beforeMode = inferSplitMode(before.allocations, before.totalMinor);
  const afterMode = inferSplitMode(after.allocations, after.totalMinor);
  if (beforeMode !== afterMode) changes.splitMode = { from: beforeMode, to: afterMode };

  const beforeIds = before.allocations.map((a) => a.personId);
  const afterIds = after.allocations.map((a) => a.personId);
  const added = afterIds.filter((id) => !beforeIds.includes(id));
  const removed = beforeIds.filter((id) => !afterIds.includes(id));
  if (added.length > 0) changes.participantsAdded = added;
  if (removed.length > 0) changes.participantsRemoved = removed;

  const shared = afterIds.filter((id) => beforeIds.includes(id));
  const splitValues: NonNullable<ExpenseChangeSet["splitValues"]> = [];
  for (const personId of shared) {
    const a = before.allocations.find((x) => x.personId === personId)!;
    const b = after.allocations.find((x) => x.personId === personId)!;
    if (afterMode === "percentage" || beforeMode === "percentage") {
      if (round(a.percentage ?? 0, 2) !== round(b.percentage ?? 0, 2)) {
        splitValues.push({
          personId,
          fromPercentage: a.percentage ?? 0,
          toPercentage: b.percentage ?? 0,
        });
        continue;
      }
    }
    if (afterMode === "shares" || beforeMode === "shares") {
      if ((a.shares ?? 0) !== (b.shares ?? 0)) {
        splitValues.push({ personId, fromShares: a.shares ?? 0, toShares: b.shares ?? 0 });
        continue;
      }
    }
    if (a.amountMinor !== b.amountMinor && changes.amount === undefined) {
      splitValues.push({
        personId,
        fromAmountMinor: a.amountMinor,
        toAmountMinor: b.amountMinor,
      });
    }
  }
  if (splitValues.length > 0) changes.splitValues = splitValues;

  if (
    before.currency === after.currency &&
    round(before.exchangeRate) !== round(after.exchangeRate)
  ) {
    changes.fx = {
      fromRate: before.exchangeRate,
      toRate: after.exchangeRate,
      currency: after.currency,
      systemCurrency: after.systemCurrency,
    };
  }

  const itemsAdded = after.items
    .filter((item) => !before.items.some((b) => b.name === item.name))
    .map((item) => item.name);
  const itemsRemoved = before.items
    .filter((item) => !after.items.some((b) => b.name === item.name))
    .map((item) => item.name);
  const itemsChanged = after.items
    .map((item) => {
      const previous = before.items.find((b) => b.name === item.name);
      if (!previous || previous.totalMinor === item.totalMinor) return null;
      return { name: item.name, from: previous.totalMinor, to: item.totalMinor };
    })
    .filter((entry): entry is { name: string; from: number; to: number } => entry !== null);
  if (itemsAdded.length > 0 || itemsRemoved.length > 0 || itemsChanged.length > 0) {
    changes.items = {
      added: itemsAdded,
      removed: itemsRemoved,
      changed: itemsChanged,
      currency: after.currency,
    };
  }

  return changes;
}

export function hasChanges(changes: ExpenseChangeSet | null | undefined) {
  return Boolean(changes) && Object.keys(changes as object).length > 0;
}

export type ChangeDetail = { name?: string; value: string };
export type ChangeLine = { key: string; label: string; details: ChangeDetail[] };

/** Keeps very long item lists from turning the history into a data dump. */
const MAX_ITEM_LINES = 6;

export function describeChanges(
  changes: ExpenseChangeSet,
  ctx: { t: Translate; personName: (id: string) => string; groupName: (id: string) => string },
): ChangeLine[] {
  const { t, personName, groupName } = ctx;
  const lines: ChangeLine[] = [];
  const arrow = (from: string, to: string) => `${from} → ${to}`;

  if (changes.title) {
    lines.push({
      key: "title",
      label: t("history.titleChanged"),
      details: [{ value: arrow(changes.title.from, changes.title.to) }],
    });
  }

  if (changes.amount) {
    lines.push({
      key: "amount",
      label: t("history.amountChanged"),
      details: [
        {
          value: arrow(
            formatMinorIn(changes.amount.from, changes.amount.currency, { compact: false }),
            formatMinorIn(changes.amount.to, changes.amount.currency, { compact: false }),
          ),
        },
      ],
    });
  }

  if (changes.payer) {
    lines.push({
      key: "payer",
      label: t("history.payerChanged"),
      details: [{ value: arrow(personName(changes.payer.from), personName(changes.payer.to)) }],
    });
  }

  if (changes.group) {
    lines.push({
      key: "group",
      label: t("history.groupChanged"),
      details: [
        {
          value: arrow(
            changes.group.from ? groupName(changes.group.from) : t("history.noGroup"),
            changes.group.to ? groupName(changes.group.to) : t("history.noGroup"),
          ),
        },
      ],
    });
  }

  const splitDetails: ChangeDetail[] = [];
  if (changes.splitMode) {
    splitDetails.push({
      value: arrow(t(MODE_KEYS[changes.splitMode.from]), t(MODE_KEYS[changes.splitMode.to])),
    });
  }
  const pct = (value: number) =>
    `${new Intl.NumberFormat("da-DK", { maximumFractionDigits: 2 }).format(value)} %`;
  for (const value of changes.splitValues ?? []) {
    const name = personName(value.personId);
    if (value.fromPercentage !== undefined || value.toPercentage !== undefined) {
      splitDetails.push({
        name,
        value: arrow(pct(value.fromPercentage ?? 0), pct(value.toPercentage ?? 0)),
      });
    } else if (value.fromShares !== undefined || value.toShares !== undefined) {
      const unit = (count: number) =>
        `${count} ${count === 1 ? t("history.shareOne") : t("history.shareMany")}`;
      splitDetails.push({ name, value: arrow(unit(value.fromShares ?? 0), unit(value.toShares ?? 0)) });
    } else if (value.fromAmountMinor !== undefined && changes.amount === undefined) {
      splitDetails.push({
        name,
        value: arrow(
          formatMinor(value.fromAmountMinor, { compact: false }),
          formatMinor(value.toAmountMinor ?? 0, { compact: false }),
        ),
      });
    }
  }
  if (splitDetails.length > 0) {
    lines.push({ key: "split", label: t("history.splitChanged"), details: splitDetails });
  }

  const peopleDetails: ChangeDetail[] = [
    ...(changes.participantsAdded ?? []).map((id) => ({
      value: t("history.personAdded", { name: personName(id) }),
    })),
    ...(changes.participantsRemoved ?? []).map((id) => ({
      value: t("history.personRemoved", { name: personName(id) }),
    })),
  ];
  if (peopleDetails.length > 0) {
    lines.push({ key: "people", label: t("history.peopleChanged"), details: peopleDetails });
  }

  if (changes.fx) {
    const rate = (value: number) =>
      `1 ${changes.fx!.currency} = ${value.toLocaleString(undefined, {
        maximumFractionDigits: 4,
      })} ${changes.fx!.systemCurrency}`;
    lines.push({
      key: "fx",
      label: t("history.rateChanged"),
      details: [{ value: arrow(rate(changes.fx.fromRate), rate(changes.fx.toRate)) }],
    });
  }

  if (changes.items) {
    const { added, removed, changed, currency } = changes.items;
    const count = added.length + removed.length + changed.length;
    const details: ChangeDetail[] = [
      {
        value:
          count === 1 ? t("history.itemsChangedOne") : t("history.itemsChanged", { count }),
      },
      ...changed.map((item) => ({
        name: item.name,
        value: arrow(
          formatMinorIn(item.from, currency, { compact: false }),
          formatMinorIn(item.to, currency, { compact: false }),
        ),
      })),
      ...added.map((name) => ({ value: t("history.itemAdded", { name }) })),
      ...removed.map((name) => ({ value: t("history.itemRemoved", { name }) })),
    ];
    const visible = details.slice(0, MAX_ITEM_LINES + 1);
    if (details.length > visible.length) {
      visible.push({ value: t("history.moreChanges", { count: details.length - visible.length }) });
    }
    lines.push({ key: "items", label: t("history.items"), details: visible });
  }

  return lines;
}
