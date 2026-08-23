import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildParsedJson,
  decodeJpegDataUrl,
  MAX_RECEIPT_BYTES,
  RECEIPT_BUCKET,
  type SaveReceiptInput,
} from "./receipt-persistence.server";

/**
 * Uploads the normalized JPEG privately, creates the owner-only receipts row and
 * links it to an expense the caller owns. Compensates on every partial failure so
 * no orphan object or invisible unlinked receipt is left behind.
 */
export const saveReceiptForExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SaveReceiptInput) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let bytes: Uint8Array;
    try {
      bytes = decodeJpegDataUrl(data.dataUrl);
    } catch {
      return { ok: false as const, reason: "invalid_image" as const };
    }
    if (bytes.byteLength <= 0 || bytes.byteLength > MAX_RECEIPT_BYTES) {
      return { ok: false as const, reason: "invalid_image" as const };
    }

    // Path is derived from the trusted identity only — never from the browser.
    const receiptId = crypto.randomUUID();
    const storagePath = `${userId}/${receiptId}/original.jpg`;

    const upload = await supabase.storage
      .from(RECEIPT_BUCKET)
      .upload(storagePath, bytes, { contentType: "image/jpeg", upsert: false });
    if (upload.error) {
      console.error("[receipt] upload_failed", upload.error.message);
      return { ok: false as const, reason: "upload_failed" as const };
    }

    const cleanupObject = async () => {
      await supabase.storage.from(RECEIPT_BUCKET).remove([storagePath]);
    };

    const inserted = await supabase.from("receipts").insert({
      id: receiptId,
      owner_user_id: userId,
      storage_path: storagePath,
      mime_type: "image/jpeg",
      file_size_bytes: bytes.byteLength,
      merchant_name: data.merchantName ?? null,
      purchase_date: data.purchaseDate ?? null,
      currency: data.currency ?? null,
      total_minor: data.totalMinor ?? null,
      parsed_json: buildParsedJson(data),
    });
    if (inserted.error) {
      console.error("[receipt] row_insert_failed", inserted.error.message);
      await cleanupObject();
      return { ok: false as const, reason: "row_failed" as const };
    }

    const linked = await supabase
      .from("expenses")
      .update({ receipt_id: receiptId })
      .eq("id", data.expenseId)
      .select("id")
      .maybeSingle();

    if (linked.error || !linked.data) {
      console.error("[receipt] link_failed", linked.error?.message ?? "no row");
      // No archive UI exists yet, so an unlinked receipt would be invisible
      // private data. Remove it rather than stranding it.
      await supabase.from("receipts").delete().eq("id", receiptId);
      await cleanupObject();
      return { ok: false as const, reason: "link_failed" as const };
    }

    return { ok: true as const, receiptId };
  });

/** Owner-only receipt summary for an expense. Returns null for every other viewer. */
export const getExpenseReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { expenseId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const expense = await supabase
      .from("expenses")
      .select("receipt_id")
      .eq("id", data.expenseId)
      .maybeSingle();
    const receiptId = expense.data?.receipt_id;
    if (!receiptId) return null;

    // RLS decides: a participant who is not the owner simply gets no row.
    const receipt = await supabase
      .from("receipts")
      .select("id, merchant_name, purchase_date, currency, total_minor, note, warranty_expires_at")
      .eq("id", receiptId)
      .maybeSingle();
    if (receipt.error || !receipt.data) return null;

    return {
      id: receipt.data.id,
      merchantName: receipt.data.merchant_name,
      purchaseDate: receipt.data.purchase_date,
      currency: receipt.data.currency,
      totalMinor: receipt.data.total_minor,
      note: receipt.data.note,
      warrantyExpiresAt: receipt.data.warranty_expires_at,
    };
  });

/** Short-lived signed URL for the caller's own receipt image. Never persisted. */
export const getReceiptSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { receiptId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const receipt = await supabase
      .from("receipts")
      .select("storage_path")
      .eq("id", data.receiptId)
      .maybeSingle();
    if (receipt.error || !receipt.data) return null;

    const signed = await supabase.storage
      .from(RECEIPT_BUCKET)
      .createSignedUrl(receipt.data.storage_path, 60);
    if (signed.error || !signed.data?.signedUrl) return null;
    return { url: signed.data.signedUrl, expiresInSeconds: 60 };
  });
