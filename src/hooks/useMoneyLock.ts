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
  rateDate: string | null;
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
 *
 * For an existing expense, pass `stored`: the rate locked when it was saved is
 * reused and no new rate is fetched. A rate is only looked up again when the
 * original currency actually changes (the stored pair no longer applies).
 */
export function useMoneyLock(input: {
  currency: string;
  systemCurrency: string;
  totalMinor: number;
  dateIso?: string | null;
  stored?: {
    currency: string;
    rate: number;
    rateDate: string | null;
    source: string;
    cardMinor: number | null;
  } | null;
}): MoneyLock {
  const [manualRate, setManualRate] = useState<number | null>(null);
  const [cardOverride, setCardOverride] = useState<number | null>(null);

  const foreign = input.currency !== input.systemCurrency;
  const stored = input.stored && input.stored.currency === input.currency ? input.stored : null;
  const fetched = useExchangeRate(input.currency, input.systemCurrency, input.dateIso ?? null, {
    enabled: !stored,
  });

  const rate =
    manualRate && manualRate > 0 ? manualRate : stored ? stored.rate : fetched.rate;
  const rateDate = stored?.rateDate ?? fetched.rateDate;
  const cardMinor = cardOverride ?? stored?.cardMinor ?? null;
  const convertedMinor =
    cardMinor && cardMinor > 0
      ? cardMinor
      : rate != null
        ? convertMinor(input.totalMinor, rate)
        : null;

  const source = manualRate
    ? "manual"
    : cardOverride
      ? "card"
      : (stored?.source ?? "ecb");

  const money: MoneyContext | undefined = foreign
    ? {
        currency: input.currency,
        exchangeRate: rate ?? 1,
        exchangeRateDate: rateDate,
        exchangeRateSource: source,
        cardChargedMinor: cardMinor,
      }
    : undefined;

  return {
    currency: input.currency,
    systemCurrency: input.systemCurrency,
    foreign,
    rate,
    rateDate,
    loading: stored ? false : fetched.loading,
    failed: !stored && fetched.failed && !manualRate,
    manualRate,
    setManualRate,
    cardMinor,
    setCardMinor: setCardOverride,
    convertedMinor,
    money,
  };
}

