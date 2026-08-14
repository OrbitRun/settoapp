import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ParsedReceiptLine = {
  name: string;
  quantity: number;
  unitPriceMinor: number;
};

export type ParsedReceiptPayload = {
  merchant: string | null;
  totalMinor: number;
  dateIso: string | null;
  currency: string | null;
  items: ParsedReceiptLine[];
};

const SYSTEM_PROMPT = `You read photos of retail receipts and return structured data.
Rules:
- Return every purchased line item you can read, in the order printed.
- Prices are per unit, in MAJOR currency units (e.g. 24.95), not cents.
- Ignore discounts lines, loyalty text, VAT summaries, payment lines and totals as items.
- If a line has a quantity (e.g. "2 x"), set quantity and the per-unit price.
- "total" is the final amount actually paid, in MAJOR units.
- date is the receipt date as YYYY-MM-DD when visible, otherwise null.
- If the image is not a receipt, return an empty items array and total 0.`;

type GatewayResponse = {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
};

function toMinor(value: unknown): number {
  const number = typeof value === "number" ? value : Number.parseFloat(String(value ?? "0"));
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 100);
}

export const parseReceiptImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { dataUrl: string }) => {
    if (!input?.dataUrl?.startsWith("data:image/")) {
      throw new Error("An image is required");
    }
    return input;
  })
  .handler(async ({ data }): Promise<ParsedReceiptPayload> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        reasoning_effort: "none",
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
              required: ["merchant", "total", "currency", "date", "items"],
              properties: {
                merchant: { type: ["string", "null"] },
                total: { type: "number" },
                currency: { type: ["string", "null"] },
                date: { type: ["string", "null"] },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["name", "quantity", "unit_price"],
                    properties: {
                      name: { type: "string" },
                      quantity: { type: "number" },
                      unit_price: { type: "number" },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("[parseReceipt] gateway error", response.status, detail);
      if (response.status === 429) throw new Error("Rate limited, try again shortly");
      if (response.status === 402) throw new Error("AI credits exhausted");
      throw new Error("Receipt reading failed");
    }

    const payload = (await response.json()) as GatewayResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("Receipt reading returned nothing");

    let parsed: {
      merchant?: string | null;
      total?: number;
      currency?: string | null;
      date?: string | null;
      items?: { name?: string; quantity?: number; unit_price?: number }[];
    };
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("[parseReceipt] unparsable content", content.slice(0, 400));
      throw new Error("Receipt reading failed");
    }

    const items: ParsedReceiptLine[] = (parsed.items ?? [])
      .filter((item) => (item?.name ?? "").trim().length > 0)
      .map((item) => ({
        name: String(item.name).trim(),
        quantity: Math.max(1, Math.round(Number(item.quantity ?? 1)) || 1),
        unitPriceMinor: Math.max(0, toMinor(item.unit_price)),
      }));

    const itemsTotal = items.reduce(
      (sum, item) => sum + item.unitPriceMinor * item.quantity,
      0,
    );

    const total = toMinor(parsed.total);

    return {
      merchant: parsed.merchant?.trim() || null,
      totalMinor: total > 0 ? total : itemsTotal,
      dateIso: parsed.date ?? null,
      currency: parsed.currency?.trim() || null,
      items,
    };
  });
