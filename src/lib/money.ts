/**
 * Money helpers. All internal amounts are integers in minor units (øre).
 * Never do arithmetic on decimal currency values.
 */

export const MINOR_PER_MAJOR = 100;

/** App-wide currency/locale, set once from the signed-in profile. */
let defaultCurrency = "DKK";
let defaultLocale = "da-DK";

export function setMoneyDefaults(currency: string, locale: string) {
  defaultCurrency = currency;
  defaultLocale = locale;
}

export function toMinor(major: number): number {
  return Math.round(major * MINOR_PER_MAJOR);
}

export function toMajor(minor: number): number {
  return minor / MINOR_PER_MAJOR;
}

/** Parses free-form user input ("1.248,50", "1248.5") into minor units. */
export function parseAmountToMinor(input: string): number {
  const cleaned = input.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value)) return 0;
  return toMinor(value);
}

type FormatOptions = {
  currency?: string;
  /** Hide decimals when the amount is a whole major unit. */
  compact?: boolean;
  showSign?: boolean;
};

export function formatMinor(minor: number, options: FormatOptions = {}): string {
  const { currency = defaultCurrency, compact = true, showSign = false } = options;
  return formatMoney(minor, currency, defaultLocale, { compact, showSign });
}

export function formatMinorNumber(minor: number, compact = true): string {
  return formatMinor(minor, { currency: "", compact }).trim();
}

/**
 * Central money formatter. All currency output in the app goes through here
 * (directly, or via formatMinor which delegates to it).
 */
export function formatMoney(
  amountMinor: number,
  currency = defaultCurrency,
  locale = defaultLocale,
  options: { compact?: boolean; showSign?: boolean } = {},
): string {
  const { compact = true, showSign = false } = options;
  const abs = Math.abs(amountMinor);
  const digits = compact && abs % MINOR_PER_MAJOR === 0 ? 0 : 2;

  const number = new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(toMajor(abs));

  const sign = showSign ? (amountMinor < 0 ? "−" : "+") : amountMinor < 0 ? "−" : "";
  return `${sign}${number}${currency ? ` ${currency}` : ""}`;
}
