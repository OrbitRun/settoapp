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

/** Signed URLs are short-lived on purpose and never persisted anywhere. */
export const THUMBNAIL_TTL_SECONDS = 120;

export type ReceiptLine = {
  name: string;
  quantity: number | null;
  unitPriceMinor: number | null;
  discountMinor: number | null;
};

/** Reads display-worthy line items straight out of parsed_json — no schema growth. */
export function extractLines(parsed: unknown): ReceiptLine[] {
  const lines = (parsed as { lines?: unknown } | null)?.lines;
  if (!Array.isArray(lines)) return [];
  return lines.slice(0, 200).map((raw) => {
    const line = (raw ?? {}) as Record<string, unknown>;
    const num = (value: unknown) => (typeof value === "number" ? value : null);
    return {
      name: typeof line["name"] === "string" ? line["name"] : "",
      quantity: num(line["quantity"]),
      unitPriceMinor: num(line["unit_price_minor"]),
      discountMinor: num(line["discount_minor"]),
    };
  });
}

export type UpdateReceiptMetaInput = {
  receiptId: string;
  note?: string | null;
  warrantyExpiresAt?: string | null;
  merchantName?: string | null;
  purchaseDate?: string | null;
  totalMinor?: number | null;
  currency?: string | null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Only mutable metadata columns are ever built into an update statement. */
export type ReceiptMetaPatch = {
  note?: string | null;
  warranty_expires_at?: string | null;
  merchant_name?: string | null;
  purchase_date?: string | null;
  total_minor?: number | null;
  currency?: string | null;
};

export function buildMetaPatch(input: UpdateReceiptMetaInput): ReceiptMetaPatch | null {
  const patch: ReceiptMetaPatch = {};
  const text = (value: string | null | undefined) => {
    const trimmed = (value ?? "").trim();
    return trimmed === "" ? null : trimmed;
  };

  if ("note" in input) patch.note = text(input.note);
  if ("warrantyExpiresAt" in input) {
    const value = text(input.warrantyExpiresAt);
    if (value !== null && !ISO_DATE.test(value)) return null;
    patch.warranty_expires_at = value;
  }
  if ("merchantName" in input) patch.merchant_name = text(input.merchantName);
  if ("purchaseDate" in input) {
    const value = text(input.purchaseDate);
    if (value !== null && !ISO_DATE.test(value)) return null;
    patch.purchase_date = value;
  }
  if ("totalMinor" in input) {
    const value = input.totalMinor;
    if (value != null && (!Number.isFinite(value) || value < 0)) return null;
    patch.total_minor = value ?? null;
  }
  if ("currency" in input) {
    const value = text(input.currency);
    if (value !== null && !/^[A-Za-z]{3}$/.test(value)) return null;
    patch.currency = value ? value.toUpperCase() : null;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

type StorageCapable = {
  storage: {
    from: (bucket: string) => {
      remove: (paths: string[]) => Promise<{ error: { message: string } | null }>;
      list: (
        prefix: string,
        options?: Record<string, unknown>,
      ) => Promise<{ data: { name: string }[] | null; error: { message: string } | null }>;
    };
  };
};

/**
 * Removes private receipt objects and verifies afterwards that nothing is left.
 * An object that was already gone counts as cleaned.
 */
export async function removeReceiptObjects(
  client: StorageCapable,
  paths: string[],
): Promise<{ ok: boolean; remaining: string[] }> {
  if (paths.length === 0) return { ok: true, remaining: [] };
  const bucket = client.storage.from(RECEIPT_BUCKET);
  const removal = await bucket.remove(paths);
  if (removal.error) {
    console.error("[receipt] storage_remove_error", removal.error.message);
  }

  const remaining: string[] = [];
  for (const path of paths) {
    const slash = path.lastIndexOf("/");
    const folder = path.slice(0, slash);
    const file = path.slice(slash + 1);
    const listing = await bucket.list(folder, { limit: 100 });
    if (listing.error) {
      // Unknown state: treat as not verified rather than silently succeeding.
      remaining.push(path);
      continue;
    }
    if ((listing.data ?? []).some((entry) => entry.name === file)) remaining.push(path);
  }
  return { ok: remaining.length === 0, remaining };
}
