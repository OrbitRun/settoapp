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
  /** Bypass privacy mode — only for editable inputs the user is actively typing in. */
  raw?: boolean;
};

export function formatMinor(minor: number, options: FormatOptions = {}): string {
  const { currency = defaultCurrency, compact = true, showSign = false, raw = false } = options;
  return formatMoney(minor, currency, defaultLocale, { compact, showSign, raw });
}

/** Plain number, no currency. Used by editable amount inputs, so never masked. */
export function formatMinorNumber(minor: number, compact = true): string {
  return formatMinor(minor, { currency: "", compact, raw: true }).trim();
}

/**
 * Central money formatter. All currency output in the app goes through here
 * (directly, or via formatMinor which delegates to it).
 */
export function formatMoney(
  amountMinor: number,
  currency = defaultCurrency,
  locale = defaultLocale,
  options: { compact?: boolean; showSign?: boolean; raw?: boolean } = {},
): string {
  const { compact = true, showSign = false, raw = false } = options;
  const abs = Math.abs(amountMinor);
  const digits = compact && abs % MINOR_PER_MAJOR === 0 ? 0 : 2;

  const masked = !raw && getHideAmounts();
  const number = masked
    ? AMOUNT_MASK
    : new Intl.NumberFormat(locale, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(toMajor(abs));

  const sign = showSign ? (amountMinor < 0 ? "−" : "+") : amountMinor < 0 ? "−" : "";
  return `${sign}${number}${currency ? `\u00a0${currencyLabel(currency, locale)}` : ""}`;
}


/** Consumer-facing currency wording: Danish says "kr.", not "DKK". */
export function currencyLabel(currency = defaultCurrency, locale = defaultLocale): string {
  if (currency === "DKK") return locale.toLowerCase().startsWith("da") ? "kr." : "DKK";
  return CURRENCY_SYMBOLS[currency] ?? currency;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  CHF: "CHF",
  SEK: "kr",
  NOK: "kr",
  PLN: "zł",
  CZK: "Kč",
  JPY: "¥",
};

/** Currencies offered in the manual currency picker. */
export const CURRENCY_OPTIONS = [
  "DKK",
  "EUR",
  "USD",
  "GBP",
  "SEK",
  "NOK",
  "CHF",
  "PLN",
  "CZK",
] as const;

/** Formats an amount in an explicit currency, independent of the profile currency. */
export function formatMinorIn(
  minor: number,
  currency: string,
  options: { compact?: boolean; showSign?: boolean } = {},
): string {
  return formatMoney(minor, currency, defaultLocale, options);
}

export function normaliseCurrency(value: string | null | undefined): string | null {
  const code = (value ?? "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
}
