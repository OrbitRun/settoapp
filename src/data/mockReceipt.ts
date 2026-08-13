import type { DraftItem } from "./draft";

/** Mock OCR output. Real receipt parsing gets wired in later. */
export const MOCK_RECEIPT = {
  merchant: "Netto",
  totalMinor: 48600,
  dateIso: new Date().toISOString(),
  items: [
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
  ] as [string, number][],
};

export function mockReceiptItems(): DraftItem[] {
  return MOCK_RECEIPT.items.map(([name, price], index) => ({
    id: `ritem_${index}`,
    name,
    quantity: 1,
    unitPriceMinor: price,
    isShared: true,
    assigned: [],
  }));
}
