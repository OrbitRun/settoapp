import type { DraftItem } from "@/data/draft";
import { parseReceiptImage } from "./parseReceipt.functions";

export type ParsedReceipt = {
  merchant: string;
  totalMinor: number;
  dateIso: string;
  items: DraftItem[];
};

const MAX_EDGE = 1600;

/** Downscales + re-encodes the photo so the upload stays small and readable. */
async function toDataUrl(image: File | Blob): Promise<string> {
  if (typeof document === "undefined" || typeof createImageBitmap === "undefined") {
    return readAsDataUrl(image);
  }
  try {
    const bitmap = await createImageBitmap(image);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return readAsDataUrl(image);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return canvas.toDataURL("image/jpeg", 0.82);
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

export async function parseReceipt(image: File | Blob): Promise<ParsedReceipt> {
  if (!image) throw new Error("No image supplied");

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

  if (items.length === 0 && parsed.totalMinor === 0) {
    throw new Error("No receipt found in that image");
  }

  return {
    merchant: parsed.merchant ?? "Receipt",
    totalMinor: parsed.totalMinor,
    dateIso: parsed.dateIso
      ? new Date(`${parsed.dateIso}T12:00:00`).toISOString()
      : new Date().toISOString(),
    items,
  };
}
