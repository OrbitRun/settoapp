import {
  calculateEqualSplit,
  calculateExactSplit,
  calculatePercentageSplit,
  calculateShareSplit,
  type Allocation,
  type SplitMode,
} from "@/lib/split";

export type DraftItem = {
  id: string;
  name: string;
  quantity: number;
  /** Effective price actually paid, per unit. All split math uses this. */
  unitPriceMinor: number;
  /** Pre-discount unit price, when the receipt printed one. Display only. */
  originalUnitPriceMinor?: number | null;
  /** Discount for the whole line (all units), positive. Display only. */
  discountMinor?: number;
  discountPercent?: number | null;
  /** false = private, kept out of the shared expense */
  isShared: boolean;
  /** person ids sharing this item; empty means "everyone in the expense" */
  assigned: string[];
};

export type SplitDraft = {
  source: "manual" | "receipt";
  title: string;
  merchant: string | null;
  amountMinor: number;
  groupId: string | null;
  paidByPersonId: string;
  participants: string[];
  mode: SplitMode;
  percentages: Record<string, number>;
  shares: Record<string, number>;
  exact: Record<string, number>;
  items: DraftItem[];
  splitByItem: boolean;
  usingGroupDefault: boolean;
  /** Soft warnings from the receipt reader, shown on the review screen. */
  receiptWarnings?: string[];
  /** Discount that applies to the whole receipt rather than a single line. */
  receiptDiscountMinor?: number;
};



export const itemTotalMinor = (item: DraftItem) => item.unitPriceMinor * item.quantity;

export const sharedItems = (items: DraftItem[]) => items.filter((item) => item.isShared);

export const sharedItemsTotalMinor = (items: DraftItem[]) =>
  sharedItems(items).reduce((sum, item) => sum + itemTotalMinor(item), 0);

export const itemsTotalMinor = (items: DraftItem[]) =>
  items.reduce((sum, item) => sum + itemTotalMinor(item), 0);

/** The amount actually being shared: shared items when itemised, else the full amount. */
export function draftSharedTotalMinor(draft: SplitDraft): number {
  if (draft.items.length > 0 && (draft.splitByItem || sharedItems(draft.items).length < draft.items.length)) {
    return sharedItemsTotalMinor(draft.items);
  }
  return draft.amountMinor;
}

/** Resolves the draft into final per-person allocations. Single source of truth. */
export function computeDraftAllocations(draft: SplitDraft): Allocation[] {
  const total = draftSharedTotalMinor(draft);
  const participants = draft.participants;
  if (participants.length === 0) return [];

  if (draft.splitByItem && draft.items.length > 0) {
    const totals = new Map<string, number>(participants.map((id) => [id, 0]));
    for (const item of sharedItems(draft.items)) {
      const people = item.assigned.length > 0 ? item.assigned : participants;
      for (const allocation of calculateEqualSplit(itemTotalMinor(item), people)) {
        totals.set(allocation.personId, (totals.get(allocation.personId) ?? 0) + allocation.amountMinor);
      }
    }
    return [...totals.entries()]
      .filter(([, amount]) => amount > 0)
      .map(([personId, amountMinor]) => ({ personId, amountMinor }));
  }

  switch (draft.mode) {
    case "percentage":
      return calculatePercentageSplit(
        total,
        participants.map((personId) => ({
          personId,
          percentage: draft.percentages[personId] ?? 0,
        })),
      );
    case "shares":
      return calculateShareSplit(
        total,
        participants.map((personId) => ({ personId, shares: draft.shares[personId] ?? 1 })),
      );
    case "exact":
      return calculateExactSplit(
        total,
        participants.map((personId) => ({
          personId,
          amountMinor: draft.exact[personId] ?? 0,
        })),
      ).allocations;
    case "equal":
    default:
      return calculateEqualSplit(total, participants);
  }
}

export const splitModeLabelKey: Record<SplitMode, string> = {
  equal: "split.equal",
  percentage: "split.percentage",
  shares: "split.shares",
  exact: "split.exact",
};

export const splitModeHintKey: Record<SplitMode, string> = {
  equal: "split.equalHint",
  percentage: "split.percentageHint",
  shares: "split.sharesHint",
  exact: "split.exactHint",
};


export function emptyDraft(paidByPersonId: string): SplitDraft {
  return {
    source: "manual",
    title: "",
    merchant: null,
    amountMinor: 0,
    groupId: null,
    paidByPersonId,
    participants: [paidByPersonId],
    mode: "equal",
    percentages: {},
    shares: {},
    exact: {},
    items: [],
    splitByItem: false,
    usingGroupDefault: false,
  };
}
