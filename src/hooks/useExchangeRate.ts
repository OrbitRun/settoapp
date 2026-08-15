import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getExchangeRate } from "@/lib/fx.functions";

/**
 * Looks up the rate that will be locked onto the expense. Returns rate 1 when
 * the purchase is already in the system currency.
 */
export function useExchangeRate(
  originalCurrency: string,
  systemCurrency: string,
  dateIso?: string | null,
) {
  const fetchRate = useServerFn(getExchangeRate);
  const date = (dateIso ?? new Date().toISOString()).slice(0, 10);
  const same = originalCurrency === systemCurrency;

  const query = useQuery({
    queryKey: ["fx", originalCurrency, systemCurrency, date],
    queryFn: () =>
      fetchRate({ data: { base: originalCurrency, quote: systemCurrency, date } }),
    enabled: !same,
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });

  if (same) {
    return { rate: 1, rateDate: date, source: "same" as const, loading: false, failed: false };
  }

  return {
    rate: query.data?.rate ?? null,
    rateDate: query.data?.date ?? date,
    source: (query.data?.source ?? "ecb") as "ecb" | "same",
    loading: query.isPending,
    failed: query.isError,
  };
}
