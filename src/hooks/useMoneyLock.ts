import { useState } from "react";

import { useExchangeRate } from "@/hooks/useExchangeRate";
import { convertMinor } from "@/lib/fx";
import type { MoneyContext } from "@/lib/expense-money";

export type MoneyLock = {
  /** Currency the purchase was made in. */
  currency: string;
  systemCurrency: string;
  foreign: boolean;
  rate: number | null;
  rateDate: string;
  loading: boolean;
  failed: boolean;
  manualRate: number | null;
  setManualRate: (rate: number | null) => void;
  cardMinor: number | null;
  setCardMinor: (minor: number | null) => void;
  /** Preview of the total in system currency, null while the rate is unknown. */
  convertedMinor: number | null;
  /** Pass to addExpense / updateExpense; undefined when no conversion is needed. */
  money: MoneyContext | undefined;
};

/**
 * Resolves the exchange rate for a draft and keeps any manual overrides.
 * The rate is only "locked" when the expense is saved.
 */
export function useMoneyLock(input: {
  currency: string;
  systemCurrency: string;
  totalMinor: number;
  dateIso?: string | null;
}): MoneyLock {
  const [manualRate, setManualRate] = useState<number | null>(null);
  const [cardMinor, setCardMinor] = useState<number | null>(null);

  const foreign = input.currency !== input.systemCurrency;
  const fetched = useExchangeRate(input.currency, input.systemCurrency, input.dateIso ?? null);

  const rate = manualRate && manualRate > 0 ? manualRate : fetched.rate;
  const convertedMinor =
    cardMinor && cardMinor > 0
      ? cardMinor
      : rate != null
        ? convertMinor(input.totalMinor, rate)
        : null;

  const money: MoneyContext | undefined = foreign
    ? {
        currency: input.currency,
        exchangeRate: rate ?? 1,
        exchangeRateDate: fetched.rateDate,
        exchangeRateSource: manualRate ? "manual" : "ecb",
        cardChargedMinor: cardMinor,
      }
    : undefined;

  return {
    currency: input.currency,
    systemCurrency: input.systemCurrency,
    foreign,
    rate,
    rateDate: fetched.rateDate,
    loading: fetched.loading,
    failed: fetched.failed && !manualRate,
    manualRate,
    setManualRate,
    cardMinor,
    setCardMinor,
    convertedMinor,
    money,
  };
}
