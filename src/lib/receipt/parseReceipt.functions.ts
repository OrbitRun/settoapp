import { createServerFn } from "@tanstack/react-start";

export type ReceiptErrorCode =
  | "IMAGE_MISSING"
  | "IMAGE_TOO_LARGE"
  | "AI_NOT_CONFIGURED"
  | "AI_REQUEST_FAILED"
  | "AI_TIMEOUT"
  | "AI_RATE_LIMITED"
  | "AI_CREDITS_EXHAUSTED"
  | "AI_INVALID_RESPONSE"
  | "SCHEMA_VALIDATION_FAILED"
  | "NO_RECEIPT_DETECTED";

/** Errors cross the wire as "CODE: message" so the client can branch on the code. */
export function receiptError(code: ReceiptErrorCode, message: string): Error {
  return new Error(`${code}: ${message}`);
}

export function receiptErrorCode(error: unknown): ReceiptErrorCode | null {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const code = message.split(":")[0]?.trim();
  return code && /^[A-Z_]+$/.test(code) ? (code as ReceiptErrorCode) : null;
}

export type ReceiptConfidence = "high" | "medium" | "low";

export type ParsedReceiptLine = {
  name: string;
  quantity: number;
  /** Effective price actually paid, per unit. This is what splitting uses. */
  unitPriceMinor: number;
  /** Pre-discount price per unit, when the receipt printed one. */
  originalUnitPriceMinor: number | null;
  /** Total discount on this line (all units), always positive. */
  discountMinor: number;
  discountPercent: number | null;
  uncertain: boolean;
  /** How sure the reader is about THIS line. Never about whether to include it. */
  confidence: ReceiptConfidence;
};

export type ParsedReceiptPayload = {
  merchant: string | null;
  totalMinor: number;
  subtotalMinor: number | null;
  /** Discount that applies to the whole receipt, not one line. Positive. */
  receiptDiscountMinor: number;
  dateIso: string | null;
  /** ISO 4217 code detected on the receipt, or null when unreadable. */
  currency: string | null;
  currencyConfidence: ReceiptConfidence;
  /** What the currency guess was based on, for the review screen. */
  currencyEvidence: string | null;
  totalConfidence: ReceiptConfidence;
  items: ParsedReceiptLine[];
  warnings: string[];
  confidence: number;
};

const SYSTEM_PROMPT = `You are parsing a retail or restaurant receipt from a photo.
Read the actual image carefully.
- Extract every visible purchased item you can identify. Do not invent items.
- Prices are in MAJOR currency units (e.g. 24.95), never cents.
- "unit_price" is the price of ONE unit before discount. "original_total" is unit_price ×
  quantity. "effective_total" is what was actually paid for the line after discount.
- Receipt text may be Danish, English, Swedish, Norwegian, German or another European
  language. Do not require English terminology. Danish receipts commonly use
  TOTAL, I ALT, AT BETALE, NETTO, MOMS (tax), RABAT (discount), PRIS, VARE, ANTAL, KORT, KR.
- MOMS, loyalty text, payment/card lines and totals are not items.

DISCOUNTS — important:
- Discount wording includes: Linierabat, Linjerabat, Rabat, Vare-rabat, Tilbud,
  Kampagnerabat, Medlemsrabat, Bonus, Prisnedsættelse, Discount, Item discount, Promo,
  Promotion, Coupon, Voucher, Saving, You saved.
- A discount line is NEVER a purchased item. Never return it in "items".
- A discount printed directly under (or on the same line as) an item belongs to that item:
  set that item's "discount_amount" and "effective_total".
- A discount printed between subtotal and total, or clearly applying to the whole basket,
  is the receipt-level "discount" field instead.
- Discounts may print as "-40,00", "40,00-" or plain "40,00" next to a discount label.
  They are always deductions. A minus sign is not required. Always report discount amounts
  as POSITIVE numbers.
- If both a percentage and an amount are printed, the printed AMOUNT is authoritative;
  put the percentage in "discount_percent" as metadata only. Do not recompute it.
- If only a percentage is printed, derive the amount from the item's original total.
- If you cannot tell which item a discount belongs to, put it in the receipt-level
  "discount" field and add a warning. Never guess an item.

Example: "R* SØD TØS  1x 299.95  259.95 / Linierabat 13.34% 40.00" with "I alt 259.95"
=> one item: unit_price 299.95, quantity 1, original_total 299.95, discount_amount 40.00,
   discount_percent 13.34, effective_total 259.95; total 259.95; no receipt-level discount.

- The most important financial field is the final amount actually paid ("total").
- Return uncertain information with lower confidence and a warning rather than failing.
  Mark an item you are unsure about with "uncertain": true.
- If a field cannot be read, return null and add a short warning. Never fabricate values.
- Only return an empty items array and total null if the image is genuinely not a receipt.
- "confidence" is 0-1 for the overall read.

CURRENCY — always answer, never guess silently:
- Return "currency" as an ISO 4217 code (DKK, EUR, USD, GBP, SEK, NOK, CHF, PLN, CZK ...).
- Signal strength, strongest first:
  1. An explicit ISO code printed on the receipt ("EUR", "DKK", "USD") — high.
  2. A currency symbol or unambiguous abbreviation: € = EUR, £ = GBP, $ = USD,
     "zł" = PLN, "Kč" = CZK — high.
  3. VAT/tax wording plus country context: MOMS + "kr" = DKK, MVA + "kr" = NOK,
     MOMS + "kr" with Swedish wording = SEK, "IVA"/"MwSt"/"TVA" with € = EUR — medium.
  4. Language or address only, no monetary marker — low.
- "kr" alone is ambiguous between DKK, SEK and NOK. Use the receipt language and
  address to choose, and report medium or low, never high.
- Put the literal evidence you used in "currency_evidence" (e.g. "EUR printed next
  to TOTAL", "€ symbol", "MOMS 25%").
- Never assume DKK just because you often see Danish receipts.

PER-FIELD CONFIDENCE:
- Each item gets "confidence": "high" when name and amount are both clearly legible,
  "medium" when one is partially unclear, "low" when you had to infer it.
- "total_confidence" describes the final amount only.
- Confidence is about legibility. It is NEVER about whether an item should be split.

NOT ITEMS — never return these as items:
- Payment/card lines: KORT, KONTANT, DANKORT, VISA, MASTERCARD, MOBILEPAY, BETALT,
  CARD, CASH, CHANGE, BYTTEPENGE, TIP if printed as a payment line, AFRUNDING,
  ROUNDING, GEBYR/FEE lines belonging to the payment, loyalty points, saldo.
- Totals and taxes: TOTAL, I ALT, AT BETALE, SUBTOTAL, MOMS, VAT, MWST, TVA.`;

const TIMEOUT_MS = 60_000;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

type GatewayResponse = {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
};

function toMinor(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(number)) return null;
  return Math.round(number * 100);
}

const nullableNumber = { type: ["number", "null"] } as const;
const nullableString = { type: ["string", "null"] } as const;
const confidenceEnum = { type: ["string", "null"], enum: ["high", "medium", "low", null] } as const;

const CONFIDENCE_VALUES = new Set(["high", "medium", "low"]);

export function toConfidence(
  value: string | null | undefined,
  fallback: ReceiptConfidence,
): ReceiptConfidence {
  const normalised = (value ?? "").toLowerCase();
  return CONFIDENCE_VALUES.has(normalised) ? (normalised as ReceiptConfidence) : fallback;
}

const SYMBOL_CURRENCIES: Record<string, string> = {
  "€": "EUR",
  $: "USD",
  "£": "GBP",
  zł: "PLN",
  kč: "CZK",
  "¥": "JPY",
};

/** Accepts an ISO code or a symbol the model echoed back. Never guesses. */
export function normaliseCurrencyCode(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (/^[A-Z]{3}$/.test(upper)) return upper;
  return SYMBOL_CURRENCIES[raw.toLowerCase()] ?? SYMBOL_CURRENCIES[raw] ?? null;
}

export const parseReceiptImage = createServerFn({ method: "POST" })
  .inputValidator((input: { dataUrl: string }) => {
    if (!input?.dataUrl?.startsWith("data:image/")) {
      throw receiptError("IMAGE_MISSING", "No image data URL supplied");
    }
    return input;
  })
  .handler(async ({ data }): Promise<ParsedReceiptPayload> => {
    const startedAt = Date.now();
    const mime = data.dataUrl.slice(5, data.dataUrl.indexOf(";"));
    const base64Length = data.dataUrl.length - (data.dataUrl.indexOf(",") + 1);
    const bytes = Math.round(base64Length * 0.75);
    console.log("[receipt] receipt_parse_started", { mime, bytes });

    if (bytes > MAX_IMAGE_BYTES) {
      console.error("[receipt] IMAGE_TOO_LARGE", { bytes });
      throw receiptError("IMAGE_TOO_LARGE", `Image is ${bytes} bytes`);
    }

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      console.error("[receipt] AI_NOT_CONFIGURED");
      throw receiptError("AI_NOT_CONFIGURED", "LOVABLE_API_KEY is missing");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    console.log("[receipt] ai_request_started");
    try {
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-5.6-sol",
          reasoning_effort: "low",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                { type: "text", text: "Read this receipt." },
                { type: "image_url", image_url: { url: data.dataUrl } },
              ],
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "receipt",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                required: [
                  "merchant",
                  "total",
                  "currency",
                  "currency_confidence",
                  "currency_evidence",
                  "total_confidence",
                  "date",
                  "subtotal",
                  "tax",
                  "discount",
                  "items",
                  "warnings",
                  "confidence",
                ],
                properties: {
                  merchant: nullableString,
                  total: nullableNumber,
                  currency: nullableString,
                  currency_confidence: confidenceEnum,
                  currency_evidence: nullableString,
                  total_confidence: confidenceEnum,
                  date: nullableString,
                  subtotal: nullableNumber,
                  tax: nullableNumber,
                  discount: nullableNumber,
                  confidence: nullableNumber,
                  warnings: { type: "array", items: { type: "string" } },
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: [
                        "name",
                        "quantity",
                        "unit_price",
                        "original_total",
                        "discount_amount",
                        "discount_percent",
                        "effective_total",
                        "uncertain",
                        "confidence",
                      ],
                      properties: {
                        name: { type: "string" },
                        quantity: nullableNumber,
                        unit_price: nullableNumber,
                        original_total: nullableNumber,
                        discount_amount: nullableNumber,
                        discount_percent: nullableNumber,
                        effective_total: nullableNumber,
                        uncertain: { type: ["boolean", "null"] },
                        confidence: confidenceEnum,
                      },
                    },
                  },
                },
              },
            },
          },
        }),
      });
    } catch (error) {
      clearTimeout(timer);
      const aborted = error instanceof Error && error.name === "AbortError";
      console.error("[receipt]", aborted ? "AI_TIMEOUT" : "AI_REQUEST_FAILED", String(error));
      throw aborted
        ? receiptError("AI_TIMEOUT", `No answer within ${TIMEOUT_MS}ms`)
        : receiptError("AI_REQUEST_FAILED", String(error));
    }
    clearTimeout(timer);
    console.log("[receipt] ai_response_received", {
      status: response.status,
      ms: Date.now() - startedAt,
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 600);
      console.error("[receipt] AI_REQUEST_FAILED", response.status, detail);
      if (response.status === 429) throw receiptError("AI_RATE_LIMITED", detail);
      if (response.status === 402) throw receiptError("AI_CREDITS_EXHAUSTED", detail);
      throw receiptError("AI_REQUEST_FAILED", `status ${response.status}`);
    }

    const payload = (await response.json()) as GatewayResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      console.error("[receipt] AI_INVALID_RESPONSE empty content", payload.error?.message ?? "");
      throw receiptError("AI_INVALID_RESPONSE", "Model returned no content");
    }

    let parsed: {
      merchant?: string | null;
      total?: number | null;
      currency?: string | null;
      currency_confidence?: string | null;
      currency_evidence?: string | null;
      total_confidence?: string | null;
      date?: string | null;
      subtotal?: number | null;
      discount?: number | null;
      confidence?: number | null;
      warnings?: string[] | null;
      items?: {
        name?: string;
        quantity?: number | null;
        unit_price?: number | null;
        original_total?: number | null;
        discount_amount?: number | null;
        discount_percent?: number | null;
        effective_total?: number | null;
        uncertain?: boolean | null;
        confidence?: string | null;
      }[];
    };

    try {
      parsed = JSON.parse(stripFence(content));
    } catch {
      console.error("[receipt] SCHEMA_VALIDATION_FAILED unparsable", content.slice(0, 400));
      throw receiptError("SCHEMA_VALIDATION_FAILED", "Model output was not JSON");
    }
    if (typeof parsed !== "object" || parsed === null) {
      console.error("[receipt] SCHEMA_VALIDATION_FAILED not an object");
      throw receiptError("SCHEMA_VALIDATION_FAILED", "Model output was not an object");
    }
    console.log("[receipt] schema_validated");

    const warnings = (parsed.warnings ?? []).filter(
      (warning): warning is string => typeof warning === "string" && warning.trim().length > 0,
    );

    const rawItems = (parsed.items ?? []).filter((item) => (item?.name ?? "").trim().length > 0);

    const items: ParsedReceiptLine[] = [];
    let strayDiscountMinor = 0;

    for (const raw of rawItems) {
      const name = String(raw.name).trim();
      const quantity = Math.max(1, Math.round(Number(raw.quantity ?? 1)) || 1);
      const unit = toMinor(raw.unit_price);
      let originalTotal = toMinor(raw.original_total) ?? (unit === null ? null : unit * quantity);
      let discount = Math.abs(toMinor(raw.discount_amount) ?? 0);
      let effectiveTotal = toMinor(raw.effective_total);
      const percentValue = toMinor(raw.discount_percent);
      const discountPercent = percentValue === null ? null : percentValue / 100;
      let uncertain = Boolean(raw.uncertain);

      // The model sometimes still emits a discount as its own "item" — fold it into
      // the line above rather than dropping it or treating it as a purchase.
      if (isDiscountLabel(name)) {
        const amount = Math.abs(effectiveTotal ?? originalTotal ?? 0);
        if (amount > 0) {
          const previous = items[items.length - 1];
          if (previous) {
            previous.discountMinor += amount;
            previous.unitPriceMinor = Math.max(
              0,
              Math.round(
                (previous.unitPriceMinor * previous.quantity - amount) / previous.quantity,
              ),
            );
            if (discountPercent !== null) previous.discountPercent = discountPercent;
          } else {
            strayDiscountMinor += amount;
          }
        }
        continue;
      }

      // Only a percentage printed: derive the amount from the original total.
      if (
        discount === 0 &&
        discountPercent !== null &&
        originalTotal !== null &&
        effectiveTotal === null
      ) {
        discount = Math.round((originalTotal * discountPercent) / 100);
      }
      if (effectiveTotal === null && originalTotal !== null) {
        effectiveTotal = originalTotal - discount;
      }
      if (effectiveTotal !== null && originalTotal === null) {
        originalTotal = effectiveTotal + discount;
      }
      if (effectiveTotal === null && originalTotal === null) {
        effectiveTotal = 0;
        originalTotal = 0;
        uncertain = true;
      }
      if (discount === 0 && originalTotal! > effectiveTotal!) {
        discount = originalTotal! - effectiveTotal!;
      }
      // Inconsistent trio: original − discount wins, and the line is flagged.
      if (Math.abs(originalTotal! - discount - effectiveTotal!) > 1) {
        effectiveTotal = originalTotal! - discount;
        uncertain = true;
      }

      const lineConfidence = toConfidence(raw.confidence, uncertain ? "low" : "high");
      items.push({
        name,
        quantity,
        unitPriceMinor: Math.max(0, Math.round(effectiveTotal! / quantity)),
        originalUnitPriceMinor: discount > 0 ? Math.round(originalTotal! / quantity) : null,
        discountMinor: Math.max(0, discount),
        discountPercent,
        uncertain: uncertain || (unit === null && originalTotal === 0),
        confidence: uncertain ? "low" : lineConfidence,
      });
    }

    const itemsTotal = items.reduce((sum, item) => sum + item.unitPriceMinor * item.quantity, 0);
    const reportedTotal = toMinor(parsed.total) ?? toMinor(parsed.subtotal);
    const subtotalMinor = toMinor(parsed.subtotal);
    let receiptDiscountMinor = Math.abs(toMinor(parsed.discount) ?? 0) + strayDiscountMinor;

    // Guard against double-counting: if the lines already reconcile with the total,
    // the receipt-level discount was just a summary of the line discounts.
    if (
      receiptDiscountMinor > 0 &&
      reportedTotal &&
      itemsTotal > 0 &&
      Math.abs(itemsTotal - reportedTotal) <= 1 &&
      Math.abs(itemsTotal - receiptDiscountMinor - reportedTotal) > 1
    ) {
      receiptDiscountMinor = 0;
    }

    // Partial results are useful: a total without items, or items without a total,
    // both open the review screen. Only a fully empty read is a failure.
    if (!reportedTotal && itemsTotal === 0 && items.length === 0) {
      console.error("[receipt] NO_RECEIPT_DETECTED", { warnings });
      throw receiptError("NO_RECEIPT_DETECTED", "No financial information found");
    }

    const netItemsTotal = itemsTotal - receiptDiscountMinor;
    const totalMinor =
      reportedTotal && reportedTotal > 0 ? reportedTotal : Math.max(0, netItemsTotal);

    if (items.length === 0) warnings.push("NO_ITEMS_DETECTED");
    if (!reportedTotal) warnings.push("TOTAL_NOT_FOUND");
    if (items.some((item) => item.uncertain)) warnings.push("UNCERTAIN_ITEMS");
    if (strayDiscountMinor > 0 || (receiptDiscountMinor > 0 && subtotalMinor === null)) {
      warnings.push("UNASSIGNED_DISCOUNT");
    }
    // Reconciliation runs on effective totals, with a 1 kr. rounding tolerance.
    if (reportedTotal && itemsTotal > 0 && Math.abs(reportedTotal - netItemsTotal) > 100) {
      warnings.push("TOTAL_MISMATCH");
    }

    const confidence =
      typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
        ? Math.min(1, Math.max(0, parsed.confidence))
        : warnings.length > 0
          ? 0.6
          : 0.9;

    console.log("[receipt] receipt_parse_success", {
      items: items.length,
      totalMinor,
      receiptDiscountMinor,
      warnings: warnings.length,
      confidence,
      ms: Date.now() - startedAt,
    });

    const detectedCurrency = normaliseCurrencyCode(parsed.currency);
    const currencyConfidence: ReceiptConfidence = detectedCurrency
      ? toConfidence(parsed.currency_confidence, "medium")
      : "low";
    if (!detectedCurrency) warnings.push("CURRENCY_NOT_DETECTED");
    else if (currencyConfidence === "low") warnings.push("CURRENCY_UNCERTAIN");

    return {
      merchant: parsed.merchant?.trim() || null,
      totalMinor,
      subtotalMinor,
      receiptDiscountMinor,
      dateIso: parsed.date ?? null,
      currency: detectedCurrency,
      currencyConfidence,
      currencyEvidence: parsed.currency_evidence?.trim() || null,
      totalConfidence: reportedTotal ? toConfidence(parsed.total_confidence, "high") : "low",
      items,
      warnings,
      confidence,
    };
  });

function stripFence(content: string): string {
  const trimmed = content.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
}

const DISCOUNT_LABELS =
  /(linie ?rabat|linje ?rabat|vare ?-? ?rabat|kampagne ?rabat|medlems ?rabat|rabat|tilbud|prisneds(æ|ae)ttelse|bonus|discount|promo(tion)?|coupon|voucher|savings?|you saved|reduktion|nedslag)/i;

/** True when a "line" is really a discount label, not a purchased product. */
export function isDiscountLabel(name: string): boolean {
  return DISCOUNT_LABELS.test(name.trim());
}
