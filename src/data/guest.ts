/**
 * Guest workspace — a fully local PARI dataset for people who haven't created
 * an account yet. Stored on the device so a reload (or an OAuth redirect)
 * never loses a split in progress. Never contains demo data.
 */

import { detectLanguage } from "@/lib/i18n";
import type { Expense, ExpenseItem, ExpenseSplit, Person } from "./types";
import type { SplitDraft } from "./draft";

const STORAGE_KEY = "pari.guest.v1";

export type GuestState = {
  people: Person[];
  expenses: Expense[];
  expenseItems: ExpenseItem[];
  expenseSplits: ExpenseSplit[];
  draft: SplitDraft | null;
};

export const emptyGuestState: GuestState = {
  people: [],
  expenses: [],
  expenseItems: [],
  expenseSplits: [],
  draft: null,
};

const uid = () =>
  `guest-${
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  }`;

export const isGuestId = (id: string | null | undefined) => Boolean(id?.startsWith("guest-"));

export function selfLabel(): string {
  return detectLanguage() === "da" ? "Mig" : "Me";
}

export function loadGuestState(): GuestState {
  if (typeof window === "undefined") return emptyGuestState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyGuestState;
    const parsed = JSON.parse(raw) as Partial<GuestState>;
    return { ...emptyGuestState, ...parsed };
  } catch {
    return emptyGuestState;
  }
}

export function saveGuestState(state: GuestState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — guest keeps working in memory */
  }
}

export function clearGuestState() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function makeGuestPerson(name: string, isSelf = false): Person {
  return {
    id: `guest-person-${uid()}`,
    owner_user_id: null,
    linked_profile_id: null,
    name,
    avatar_url: null,
    is_self: isSelf,
    created_at: new Date().toISOString(),
  };
}

/** Ensures the guest has a "self" person so the split flow always has a payer. */
export function withSelfPerson(state: GuestState): GuestState {
  if (state.people.some((person) => person.is_self)) return state;
  return { ...state, people: [makeGuestPerson(selfLabel(), true), ...state.people] };
}

export function makeGuestExpense(input: {
  title: string;
  merchant: string | null;
  paidByPersonId: string;
  totalMinor: number;
  source: "manual" | "receipt";
  currency: string;
  originalCurrency?: string;
  originalTotalMinor?: number;
  exchangeRate?: number;
  exchangeRateDate?: string | null;
  exchangeRateSource?: string;
  cardChargedMinor?: number | null;
  expenseDate?: string;
}): Expense {
  const now = new Date().toISOString();
  return {
    id: `guest-expense-${uid()}`,
    group_id: null,
    created_by: "guest",
    paid_by_person_id: input.paidByPersonId,
    title: input.title,
    merchant: input.merchant,
    expense_date: input.expenseDate ?? now,
    currency: input.currency,
    total_minor: input.totalMinor,
    original_currency: input.originalCurrency ?? input.currency,
    original_total_minor: input.originalTotalMinor ?? input.totalMinor,
    exchange_rate: input.exchangeRate ?? 1,
    exchange_rate_date: input.exchangeRateDate ?? null,
    exchange_rate_source: input.exchangeRateSource ?? "same",
    card_charged_minor: input.cardChargedMinor ?? null,
    source_type: input.source,
    created_at: now,
    updated_at: now,
  };
}

export function makeGuestItemId() {
  return `guest-item-${uid()}`;
}

export function makeGuestSplitId() {
  return `guest-split-${uid()}`;
}
