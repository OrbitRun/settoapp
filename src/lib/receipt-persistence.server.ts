import type { Json } from "@/integrations/supabase/types";
import type { ParsedReceiptPayload } from "@/lib/receipt/parseReceipt.functions";
import { RECEIPT_PARSER_MODEL, RECEIPT_PARSER_PROVIDER } from "@/lib/receipt/parserMeta";

export const RECEIPT_BUCKET = "receipts";
export const MAX_RECEIPT_BYTES = 6 * 1024 * 1024;

export type SaveReceiptInput = {
  expenseId: string;
  /** Normalized JPEG data URL — exactly the bytes OCR read. */
  dataUrl: string;
  merchantName: string | null;
  /** YYYY-MM-DD */
  purchaseDate: string | null;
  currency: string | null;
  totalMinor: number | null;
  merchantRaw: string | null;
  merchantAddress: string[];
  capturedAtIso: string | null;
  parsed: ParsedReceiptPayload;
};

/** Server-side guard: only real, non-empty, in-budget JPEG bytes ever reach Storage. */
export function decodeJpegDataUrl(dataUrl: string): Uint8Array {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/jpeg;base64,")) {
    throw new Error("NOT_JPEG");
  }
  const body = dataUrl.slice("data:image/jpeg;base64,".length);
  if (!body) throw new Error("EMPTY");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  // JPEG SOI marker.
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("NOT_JPEG");
  return bytes;
}

/** Receipt-level knowledge the expense row cannot hold. Never contains the image. */
export function buildParsedJson(input: SaveReceiptInput): Json {
  const parsed = input.parsed;
  return {
    version: 1,
    provider: RECEIPT_PARSER_PROVIDER,
    model: RECEIPT_PARSER_MODEL,
    captured_at: input.capturedAtIso,
    parsed_at: new Date().toISOString(),
    merchant: {
      name: input.merchantName,
      raw: input.merchantRaw,
      address: input.merchantAddress,
    },
    totals: {
      total_minor: parsed.totalMinor,
      subtotal_minor: parsed.subtotalMinor,
      receipt_discount_minor: parsed.receiptDiscountMinor,
      total_confidence: parsed.totalConfidence,
    },
    currency: {
      code: parsed.currency,
      confidence: parsed.currencyConfidence,
      evidence: parsed.currencyEvidence,
    },
    date_iso: parsed.dateIso,
    confidence: parsed.confidence,
    warnings: parsed.warnings,
    lines: parsed.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit_price_minor: item.unitPriceMinor,
      original_unit_price_minor: item.originalUnitPriceMinor,
      discount_minor: item.discountMinor,
      discount_percent: item.discountPercent,
      uncertain: item.uncertain,
      confidence: item.confidence,
    })),
  } as unknown as Json;
}
