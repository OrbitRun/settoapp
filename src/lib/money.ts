/**
 * Money helpers. All internal amounts are integers in minor units (øre).
 * Never do arithmetic on decimal currency values.
 */

export const MINOR_PER_MAJOR = 100;

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
  const { currency = "DKK", compact = true, showSign = false } = options;
  const abs = Math.abs(minor);
  const whole = abs % MINOR_PER_MAJOR === 0;
  const digits = compact && whole ? 0 : 2;

  const number = new Intl.NumberFormat("da-DK", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(toMajor(abs));

  const sign = showSign ? (minor < 0 ? "−" : "+") : minor < 0 ? "−" : "";
  return `${sign}${number}${currency ? ` ${currency}` : ""}`;
}

export function formatMinorNumber(minor: number, compact = true): string {
  return formatMinor(minor, { currency: "", compact }).trim();
}
