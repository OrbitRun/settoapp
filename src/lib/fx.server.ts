/**
 * Exchange-rate lookup. Uses the ECB reference rates published by the
 * Frankfurter API, which supports historical dates. Results are cached in
 * public.fx_rates so the same day/pair is fetched once.
 */

export type RateResult = { rate: number; date: string; source: "ecb" | "same" };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** ECB has no rate for today before publication, and none for weekends. */
export function normaliseDate(value: string | null | undefined): string {
  const today = new Date().toISOString().slice(0, 10);
  if (!value || !ISO_DATE.test(value.slice(0, 10))) return today;
  const day = value.slice(0, 10);
  return day > today ? today : day;
}

export async function readCachedRate(
  base: string,
  quote: string,
  date: string,
): Promise<number | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("fx_rates")
      .select("rate")
      .eq("base_currency", base)
      .eq("quote_currency", quote)
      .eq("rate_date", date)
      .maybeSingle();
    const rate = data?.rate;
    return typeof rate === "number" && rate > 0 ? rate : null;
  } catch {
    return null;
  }
}

export async function writeCachedRate(
  base: string,
  quote: string,
  date: string,
  rate: number,
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("fx_rates")
      .insert({ base_currency: base, quote_currency: quote, rate_date: date, rate, source: "ecb" });
  } catch {
    /* cache miss is not a failure */
  }
}

export async function fetchEcbRate(
  base: string,
  quote: string,
  date: string,
): Promise<{ rate: number; date: string }> {
  const url = `https://api.frankfurter.app/${date}?from=${base}&to=${quote}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`RATE_UNAVAILABLE: status ${response.status}`);
  const payload = (await response.json()) as { date?: string; rates?: Record<string, number> };
  const rate = payload.rates?.[quote];
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    throw new Error("RATE_UNAVAILABLE: no rate in response");
  }
  return { rate, date: payload.date ?? date };
}
