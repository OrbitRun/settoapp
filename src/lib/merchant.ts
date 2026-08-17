/**
 * Merchant normalisation.
 *
 * OCR often returns the full store header on one line:
 *   "Netto, Skibhusvej 41-45, 5000 Odense C"
 * The app should show "Netto" everywhere, while the address stays available.
 *
 * The rules are deliberately conservative: unknown independent merchant names
 * are never aggressively rewritten, only clearly address-like trailing parts
 * are peeled off.
 */

export type NormalisedMerchant = {
  /** Short, display-friendly store name. */
  name: string;
  /** Address lines detected after the store name. May be empty. */
  addressLines: string[];
  /** The original OCR text, kept for reference. */
  raw: string;
};

const POSTCODE_CITY = /^\d{4,5}\s+\p{L}[\p{L}\s.'-]*$/u;
const STREET_WORDS =
  /(vej|gade|gaden|allé|alle|allee|plads|torv|vænge|vænget|boulevard|blvd|street|st\.|road|rd\.|strasse|straße|straat|centret|centeret|center)/i;

/** True when a comma-separated fragment looks like part of a postal address. */
function isAddressLike(part: string): boolean {
  if (POSTCODE_CITY.test(part)) return true;
  // "Skibhusvej 41-45", "Vestergade 15"
  if (/\d/.test(part) && STREET_WORDS.test(part)) return true;
  return false;
}

/** Trims noise that receipts print around the store name. */
function cleanName(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/^[-–•*|\s]+|[-–•*|,;:\s]+$/g, "")
    .replace(/\s+(a\/s|aps|i\/s|k\/s|ivs|ltd\.?|gmbh|ab|as|oy|bv|nv)$/i, "")
    .trim();
}

export function normaliseMerchant(raw: string | null | undefined): NormalisedMerchant {
  const original = (raw ?? "").trim();
  if (!original) return { name: "", addressLines: [], raw: original };

  const parts = original
    .split(/[,\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  let name = parts[0] ?? original;
  const addressLines: string[] = [];
  for (const part of parts.slice(1)) {
    if (isAddressLike(part)) addressLines.push(part);
  }

  // No commas but the street is glued onto the name: "Netto Skibhusvej 41-45".
  if (addressLines.length === 0 && parts.length === 1) {
    const match = original.match(
      /^(.*?)\s+(\p{L}[\p{L}.'-]*(?:vej|gade|allé|alle|plads|torv|vænget|boulevard|street|road|strasse|straße|straat)\s*\d[\w\s\d-]*)$/iu,
    );
    if (match && cleanName(match[1] ?? "").length >= 2) {
      name = match[1] ?? name;
      addressLines.push((match[2] ?? "").trim());
    }
  }

  const cleaned = cleanName(name);
  return {
    name: cleaned.length >= 2 ? cleaned : cleanName(original) || original,
    addressLines,
    raw: original,
  };
}

/** Convenience: just the short display name. */
export const merchantDisplayName = (raw: string | null | undefined) =>
  normaliseMerchant(raw).name || null;
