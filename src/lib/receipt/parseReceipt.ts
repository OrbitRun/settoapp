import type { DraftItem } from "@/data/draft";
import type { Confidence } from "@/lib/fx";
import { parseReceiptImage, receiptErrorCode } from "./parseReceipt.functions";

export type ParsedReceipt = {
  /** Short store name used everywhere in the UI. */
  merchant: string;
  /** Full OCR merchant header, kept for reference. */
  merchantRaw: string | null;
  /** Address lines detected after the store name. */
  merchantAddress: string[];
  totalMinor: number;
  receiptDiscountMinor: number;
  dateIso: string;
  /** ISO code detected on the receipt, null when it could not be read. */
  currency: string | null;
  currencyConfidence: Confidence;
  currencyEvidence: string | null;
  totalConfidence: Confidence;
  items: DraftItem[];
  warnings: string[];
  confidence: number;
};

export { receiptErrorCode };
export type { ReceiptErrorCode } from "./parseReceipt.functions";

/** Small print needs resolution — only downscale when the photo is bigger than this. */
const MAX_EDGE = 2200;
const MAX_DATA_URL_CHARS = 6_000_000; // ~4.5 MB encoded
const QUALITIES = [0.92, 0.85, 0.75, 0.65];

async function toDataUrl(image: File | Blob): Promise<string> {
  if (typeof document === "undefined" || typeof createImageBitmap === "undefined") {
    return readAsDataUrl(image);
  }
  try {
    // imageOrientation "from-image" applies EXIF rotation, so iPhone photos
    // reach the parser upright instead of sideways.
    const bitmap = await createImageBitmap(image, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return readAsDataUrl(image);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    // Step quality down before dimensions so text stays legible.
    let dataUrl = canvas.toDataURL("image/jpeg", QUALITIES[0]);
    for (let index = 1; index < QUALITIES.length && dataUrl.length > MAX_DATA_URL_CHARS; index++) {
      dataUrl = canvas.toDataURL("image/jpeg", QUALITIES[index]);
    }
    if (dataUrl.length > MAX_DATA_URL_CHARS) {
      const shrink = document.createElement("canvas");
      shrink.width = Math.round(canvas.width * 0.7);
      shrink.height = Math.round(canvas.height * 0.7);
      shrink.getContext("2d")?.drawImage(canvas, 0, 0, shrink.width, shrink.height);
      dataUrl = shrink.toDataURL("image/jpeg", 0.8);
    }
    return dataUrl;
  } catch {
    return readAsDataUrl(image);
  }
}

function readAsDataUrl(image: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the image"));
    reader.readAsDataURL(image);
  });
}

/**
 * Compact receipt dates: "130613" (DDMMYY) and "13062013" (DDMMYYYY).
 * Only used when the parser could not give a proper ISO date, so an explicit,
 * higher-confidence date is never overwritten. Anything that is not a valid
 * calendar date (product numbers, terminal ids) is rejected.
 */
function fromCompactDate(value: string): Date | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 6 && digits.length !== 8) return null;
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const yearPart = digits.slice(4);
  const year = yearPart.length === 2 ? 2000 + Number(yearPart) : Number(yearPart);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  if (year < 1990 || year > new Date().getFullYear() + 1) return null;
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (date.getUTCDate() !== day || date.getUTCMonth() !== month - 1) return null;
  return date;
}

function toIsoDate(value: string | null): string {
  if (!value) return new Date().toISOString();
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const parsed = new Date(`${trimmed.slice(0, 10)}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  const compact = fromCompactDate(trimmed);
  if (compact) return compact.toISOString();
  const parsed = new Date(`${trimmed.slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

export async function parseReceipt(image: File | Blob): Promise<ParsedReceipt> {
  if (!image) throw new Error("IMAGE_MISSING: No image supplied");

  const dataUrl = await toDataUrl(image);
  const parsed = await parseReceiptImage({ data: { dataUrl } });

  const items: DraftItem[] = parsed.items.map((item, index) => ({
    id: `ritem_${index}_${Math.random().toString(36).slice(2, 8)}`,
    name: item.name,
    quantity: item.quantity,
    unitPriceMinor: item.unitPriceMinor,
    originalUnitPriceMinor: item.originalUnitPriceMinor,
    discountMinor: item.discountMinor,
    discountPercent: item.discountPercent,
    // Confidence describes legibility only — every readable line still starts shared.
    confidence: item.confidence,
    isShared: true,
    assigned: [],
  }));

  // A total with no readable lines still goes to review — seeded as one editable line.
  if (items.length === 0 && parsed.totalMinor > 0) {
    items.push({
      id: `ritem_total_${Math.random().toString(36).slice(2, 8)}`,
      name: parsed.merchant ?? "Total",
      quantity: 1,
      unitPriceMinor: parsed.totalMinor,
      confidence: "low",
      isShared: true,
      assigned: [],
    });
  }

  return {
    merchant: parsed.merchant ?? "Receipt",
    totalMinor: parsed.totalMinor,
    receiptDiscountMinor: parsed.receiptDiscountMinor,
    dateIso: toIsoDate(parsed.dateIso),
    currency: parsed.currency,
    currencyConfidence: parsed.currencyConfidence,
    currencyEvidence: parsed.currencyEvidence,
    totalConfidence: parsed.totalConfidence,
    items,
    warnings: parsed.warnings,
    confidence: parsed.confidence,
  };
}
