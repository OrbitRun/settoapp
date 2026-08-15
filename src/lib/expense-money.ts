/**
 * Turns an original-currency split into the values stored on an expense.
 * The rate is locked here and never recalculated afterwards.
 */

import { convertAllocations, convertMinor, rateFromCard } from "@/lib/fx";
import type { Allocation } from "@/lib/split";

export type MoneyContext = {
  /** Currency the purchase was made in. */
  currency: string;
  /** original -> system. 1 when the currencies match. */
  exchangeRate: number;
  exchangeRateDate: string | null;
  exchangeRateSource: string;
  /** Optional: what the bank actually charged, in system currency. */
  cardChargedMinor?: number | null;
};

export type LockedMoney = {
  currency: string;
  totalMinor: number;
  originalCurrency: string;
  originalTotalMinor: number;
  exchangeRate: number;
  exchangeRateDate: string | null;
  exchangeRateSource: string;
  cardChargedMinor: number | null;
  /** Shares in system currency, summing exactly to totalMinor. */
  allocations: Allocation[];
  /** Shares in the original currency, keyed by person. */
  originalByPerson: Record<string, number>;
};

export function lockMoney(input: {
  systemCurrency: string;
  originalTotalMinor: number;
  allocations: Allocation[];
  money?: MoneyContext | undefined;
}): LockedMoney {
  const system = input.systemCurrency;
  const original = input.money?.currency ?? system;
  const originalByPerson = Object.fromEntries(
    input.allocations.map((allocation) => [allocation.personId, allocation.amountMinor]),
  );

  if (original === system) {
    return {
      currency: system,
      totalMinor: input.originalTotalMinor,
      originalCurrency: system,
      originalTotalMinor: input.originalTotalMinor,
      exchangeRate: 1,
      exchangeRateDate: input.money?.exchangeRateDate ?? null,
      exchangeRateSource: "same",
      cardChargedMinor: null,
      allocations: input.allocations,
      originalByPerson,
    };
  }

  const card = input.money?.cardChargedMinor ?? null;
  const cardRate = card ? rateFromCard(card, input.originalTotalMinor) : null;
  const rate = cardRate ?? input.money?.exchangeRate ?? 1;
  const totalMinor = card && card > 0 ? card : convertMinor(input.originalTotalMinor, rate);

  return {
    currency: system,
    totalMinor,
    originalCurrency: original,
    originalTotalMinor: input.originalTotalMinor,
    exchangeRate: rate,
    exchangeRateDate: input.money?.exchangeRateDate ?? null,
    exchangeRateSource: cardRate ? "card" : (input.money?.exchangeRateSource ?? "ecb"),
    cardChargedMinor: card && card > 0 ? card : null,
    allocations: convertAllocations(input.allocations, rate, totalMinor),
    originalByPerson,
  };
}
