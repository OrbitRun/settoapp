/**
 * PARI financial engine.
 *
 * Every function operates on integers in minor units (øre) and guarantees that
 * allocations sum exactly to the total. No UI code may re-implement this math.
 */

export type Allocation = {
  personId: string;
  amountMinor: number;
  percentage?: number | undefined;
  shares?: number | undefined;
};

export type SplitMode = "equal" | "percentage" | "shares" | "exact";

/**
 * Distributes a rounding remainder across raw (fractional) allocations using
 * the largest-remainder method, so the parts always add up to `totalMinor`.
 */
export function allocateRoundingDifference(
  totalMinor: number,
  rawAmounts: { personId: string; raw: number }[],
): Allocation[] {
  if (rawAmounts.length === 0) return [];

  const floored = rawAmounts.map((entry) => ({
    personId: entry.personId,
    amountMinor: Math.floor(entry.raw),
    remainder: entry.raw - Math.floor(entry.raw),
  }));

  const distributed = floored.reduce((sum, entry) => sum + entry.amountMinor, 0);
  let leftover = totalMinor - distributed;

  const order = floored
    .map((entry, index) => ({ index, remainder: entry.remainder }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  let cursor = 0;
  while (leftover > 0 && order.length > 0) {
    const target = order[cursor % order.length]!;
    floored[target.index]!.amountMinor += 1;
    leftover -= 1;
    cursor += 1;
  }
  while (leftover < 0 && order.length > 0) {
    const target = order[order.length - 1 - (cursor % order.length)]!;
    floored[target.index]!.amountMinor -= 1;
    leftover += 1;
    cursor += 1;
  }

  return floored.map(({ personId, amountMinor }) => ({ personId, amountMinor }));
}

export function calculateEqualSplit(totalMinor: number, personIds: string[]): Allocation[] {
  if (personIds.length === 0) return [];
  const each = totalMinor / personIds.length;
  return allocateRoundingDifference(
    totalMinor,
    personIds.map((personId) => ({ personId, raw: each })),
  );
}

export function calculatePercentageSplit(
  totalMinor: number,
  entries: { personId: string; percentage: number }[],
): Allocation[] {
  const sum = entries.reduce((acc, entry) => acc + entry.percentage, 0);
  if (sum <= 0) return entries.map((e) => ({ ...e, amountMinor: 0 }));

  const allocations = allocateRoundingDifference(
    totalMinor,
    entries.map((entry) => ({
      personId: entry.personId,
      raw: (totalMinor * entry.percentage) / sum,
    })),
  );

  return allocations.map((allocation, index) => ({
    ...allocation,
    percentage: entries[index]!.percentage,
  }));
}

export function calculateShareSplit(
  totalMinor: number,
  entries: { personId: string; shares: number }[],
): Allocation[] {
  const sum = entries.reduce((acc, entry) => acc + entry.shares, 0);
  if (sum <= 0) return entries.map((e) => ({ ...e, amountMinor: 0 }));

  const allocations = allocateRoundingDifference(
    totalMinor,
    entries.map((entry) => ({
      personId: entry.personId,
      raw: (totalMinor * entry.shares) / sum,
    })),
  );

  return allocations.map((allocation, index) => ({
    ...allocation,
    shares: entries[index]!.shares,
  }));
}

/** Exact amounts entered by hand. Any difference vs the total is reported, not silently fixed. */
export function calculateExactSplit(
  totalMinor: number,
  entries: { personId: string; amountMinor: number }[],
): { allocations: Allocation[]; differenceMinor: number } {
  const assigned = entries.reduce((acc, entry) => acc + entry.amountMinor, 0);
  return {
    allocations: entries.map((entry) => ({ ...entry })),
    differenceMinor: totalMinor - assigned,
  };
}

/* ---------------------------------------------------------------- balances */

export type BalanceInput = {
  paidByPersonId: string;
  totalMinor: number;
  allocations: Allocation[];
};

export type SettlementInput = {
  fromPersonId: string;
  toPersonId: string;
  amountMinor: number;
};

export type Balance = { personId: string; netMinor: number };

/**
 * Net position per person = what they paid − what they are responsible for,
 * adjusted by settlements already made.
 */
export function calculateBalances(
  expenses: BalanceInput[],
  settlements: SettlementInput[] = [],
): Balance[] {
  const net = new Map<string, number>();
  const bump = (personId: string, delta: number) =>
    net.set(personId, (net.get(personId) ?? 0) + delta);

  for (const expense of expenses) {
    bump(expense.paidByPersonId, expense.totalMinor);
    for (const allocation of expense.allocations) {
      bump(allocation.personId, -allocation.amountMinor);
    }
  }

  for (const settlement of settlements) {
    bump(settlement.fromPersonId, settlement.amountMinor);
    bump(settlement.toPersonId, -settlement.amountMinor);
  }

  return [...net.entries()].map(([personId, netMinor]) => ({ personId, netMinor }));
}

export type SettlementStep = {
  fromPersonId: string;
  toPersonId: string;
  amountMinor: number;
};

/** Greedy simplification: fewest possible payments from net balances. */
export function calculateSettlementPlan(balances: Balance[]): SettlementStep[] {
  const debtors = balances
    .filter((b) => b.netMinor < 0)
    .map((b) => ({ ...b }))
    .sort((a, b) => a.netMinor - b.netMinor);
  const creditors = balances
    .filter((b) => b.netMinor > 0)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.netMinor - a.netMinor);

  const steps: SettlementStep[] = [];
  let d = 0;
  let c = 0;

  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d]!;
    const creditor = creditors[c]!;
    const amount = Math.min(-debtor.netMinor, creditor.netMinor);

    if (amount > 0) {
      steps.push({
        fromPersonId: debtor.personId,
        toPersonId: creditor.personId,
        amountMinor: amount,
      });
      debtor.netMinor += amount;
      creditor.netMinor -= amount;
    }

    if (debtor.netMinor === 0) d += 1;
    if (creditor.netMinor === 0) c += 1;
  }

  return steps;
}
