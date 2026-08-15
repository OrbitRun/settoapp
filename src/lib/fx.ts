/**
 * Currency conversion. The original currency is the truth about the purchase;
 * the system currency is the truth about balances. Conversion always happens
 * AFTER the split has been calculated in the original currency.
 */

import type { Allocation } from "@/lib/split";

export type Confidence = "high" | "medium" | "low";

export type ExchangeRate = {
  /** How many system-currency units one original-currency unit is worth. */
  rate: number;
  /** ISO date the rate belongs to. */
  date: string;
  source: "same" | "ecb" | "manual" | "card";
};

export const sameCurrencyRate = (date: string): ExchangeRate => ({
  rate: 1,
  date,
  source: "same",
});

export const convertMinor = (minor: number, rate: number) => Math.round(minor * rate);

/** rate implied by what the bank actually charged. */
export function rateFromCard(cardChargedMinor: number, originalMinor: number): number | null {
  if (originalMinor <= 0 || cardChargedMinor <= 0) return null;
  return cardChargedMinor / originalMinor;
}

/**
 * Converts per-person shares so they add up to exactly the converted total.
 * Largest-remainder, in whole minor units — never independently rounded.
 */
export function convertAllocations(
  allocations: Allocation[],
  rate: number,
  convertedTotalMinor: number,
): Allocation[] {
  if (allocations.length === 0) return [];

  const exact = allocations.map((allocation) => allocation.amountMinor * rate);
  const floors = exact.map((value) => Math.floor(value));
  let remainder = convertedTotalMinor - floors.reduce((sum, value) => sum + value, 0);

  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  const result = floors.slice();
  let cursor = 0;
  while (remainder > 0 && order.length > 0) {
    const target = order[cursor % order.length]!;
    result[target.index] = (result[target.index] ?? 0) + 1;
    remainder -= 1;
    cursor += 1;
  }
  cursor = 0;
  while (remainder < 0 && order.length > 0) {
    const target = order[order.length - 1 - (cursor % order.length)]!;
    if ((result[target.index] ?? 0) > 0) {
      result[target.index] = (result[target.index] ?? 0) - 1;
      remainder += 1;
    }
    cursor += 1;
    if (cursor > order.length * 4) break;
  }

  return allocations.map((allocation, index) => ({
    ...allocation,
    amountMinor: result[index] ?? 0,
  }));
}

/** Human-readable "1 EUR = 7,46 DKK" value, rounded for display only. */
export const formatRate = (rate: number) =>
  new Intl.NumberFormat("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(
    rate,
  );
