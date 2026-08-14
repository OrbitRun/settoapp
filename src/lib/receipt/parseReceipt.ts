import type { DraftItem } from "@/data/draft";

export type ParsedReceipt = {
  merchant: string;
  totalMinor: number;
  dateIso: string;
  items: DraftItem[];
};

/**
 * TEMPORARY STUB IMPLEMENTATION.
 * The internals return demo data until a real OCR/AI service is wired in.
 * The UI contract (image in → ParsedReceipt out) will not change.
 */
const DEMO_LINES: [string, number][] = [
  ["Bananer", 2400],
  ["Kylling", 6500],
  ["Toiletpapir", 4200],
  ["Proteinshake", 2800],
  ["Opvasketabs", 5500],
  ["Olivenolie", 8200],
  ["Rugbrød", 2600],
  ["Kaffe", 5400],
  ["Æg", 3500],
  ["Mælk", 4000],
  ["Ost", 3500],
];

export async function parseReceipt(image: File | Blob): Promise<ParsedReceipt> {
  if (!image) throw new Error("No image supplied");

  // Simulated processing latency; replaced by the real request later.
  await new Promise((resolve) => setTimeout(resolve, 1600));

  const items: DraftItem[] = DEMO_LINES.map(([name, price], index) => ({
    id: `ritem_${index}`,
    name,
    quantity: 1,
    unitPriceMinor: price,
    isShared: true,
    assigned: [],
  }));

  return {
    merchant: "Netto",
    totalMinor: items.reduce((sum, item) => sum + item.unitPriceMinor * item.quantity, 0),
    dateIso: new Date().toISOString(),
    items,
  };
}
