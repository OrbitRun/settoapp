import type { DraftItem } from "@/data/draft";
import { parseReceiptImage, receiptErrorCode } from "./parseReceipt.functions";

export type ParsedReceipt = {
  merchant: string;
  totalMinor: number;
  dateIso: string;
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

function toIsoDate(value: string | null): string {
  if (!value) return new Date().toISOString();
  const day = value.slice(0, 10);
  const parsed = new Date(`${day}T12:00:00`);
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
      isShared: true,
      assigned: [],
    });
  }

  return {
    merchant: parsed.merchant ?? "Receipt",
    totalMinor: parsed.totalMinor,
    dateIso: toIsoDate(parsed.dateIso),
    items,
    warnings: parsed.warnings,
    confidence: parsed.confidence,
  };
}
