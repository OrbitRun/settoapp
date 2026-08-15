import { createServerFn } from "@tanstack/react-start";

import {
  fetchEcbRate,
  normaliseDate,
  readCachedRate,
  writeCachedRate,
  type RateResult,
} from "./fx.server";

export const getExchangeRate = createServerFn({ method: "POST" })
  .inputValidator((input: { base: string; quote: string; date?: string | null }) => ({
    base: String(input?.base ?? "").toUpperCase(),
    quote: String(input?.quote ?? "").toUpperCase(),
    date: input?.date ?? null,
  }))
  .handler(async ({ data }): Promise<RateResult> => {
    const date = normaliseDate(data.date);
    if (!data.base || !data.quote || data.base === data.quote) {
      return { rate: 1, date, source: "same" };
    }

    const cached = await readCachedRate(data.base, data.quote, date);
    if (cached) return { rate: cached, date, source: "ecb" };

    const fetched = await fetchEcbRate(data.base, data.quote, date);
    await writeCachedRate(data.base, data.quote, date, fetched.rate);
    return { rate: fetched.rate, date: fetched.date, source: "ecb" };
  });
