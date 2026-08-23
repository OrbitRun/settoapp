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

/**
 * The caller's own receipts, newest first, with short-lived signed thumbnail URLs.
 * RLS scopes the rows; a non-owner simply gets an empty list.
 */
export const listMyReceipts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const rows = await supabase
      .from("receipts")
      .select(
        "id, merchant_name, purchase_date, currency, total_minor, note, warranty_expires_at, storage_path, created_at",
      )
      .order("created_at", { ascending: false });
    if (rows.error || !rows.data) return [];

    // One batched signing call rather than one per card.
    const signed = await supabase.storage
      .from(RECEIPT_BUCKET)
      .createSignedUrls(
        rows.data.map((row) => row.storage_path),
        THUMBNAIL_TTL_SECONDS,
      );
    const urlByPath = new Map<string, string>();
    for (const entry of signed.data ?? []) {
      if (entry.signedUrl && entry.path) urlByPath.set(entry.path, entry.signedUrl);
    }

    const links = await supabase
      .from("expenses")
      .select("id, receipt_id")
      .in(
        "receipt_id",
        rows.data.map((row) => row.id),
      );
    const expenseByReceipt = new Map<string, string>();
    for (const link of links.data ?? []) {
      if (link.receipt_id) expenseByReceipt.set(link.receipt_id, link.id);
    }

    return rows.data.map((row) => ({
      id: row.id,
      merchantName: row.merchant_name,
      purchaseDate: row.purchase_date,
      currency: row.currency,
      totalMinor: row.total_minor,
      note: row.note,
      warrantyExpiresAt: row.warranty_expires_at,
      createdAt: row.created_at,
      thumbnailUrl: urlByPath.get(row.storage_path) ?? null,
      linkedExpenseId: expenseByReceipt.get(row.id) ?? null,
    }));
  });

/** Full owner-only receipt detail: metadata, parsed lines, image URL and linked expense. */
export const getReceiptDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { receiptId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const receipt = await supabase
      .from("receipts")
      .select(
        "id, merchant_name, purchase_date, currency, total_minor, note, warranty_expires_at, storage_path, parsed_json, created_at",
      )
      .eq("id", data.receiptId)
      .maybeSingle();
    if (receipt.error || !receipt.data) return null;

    const signed = await supabase.storage
      .from(RECEIPT_BUCKET)
      .createSignedUrl(receipt.data.storage_path, THUMBNAIL_TTL_SECONDS);

    const link = await supabase
      .from("expenses")
      .select("id")
      .eq("receipt_id", receipt.data.id)
      .maybeSingle();

    return {
      id: receipt.data.id,
      merchantName: receipt.data.merchant_name,
      purchaseDate: receipt.data.purchase_date,
      currency: receipt.data.currency,
      totalMinor: receipt.data.total_minor,
      note: receipt.data.note,
      warrantyExpiresAt: receipt.data.warranty_expires_at,
      createdAt: receipt.data.created_at,
      imageUrl: signed.data?.signedUrl ?? null,
      linkedExpenseId: link.data?.id ?? null,
      lines: extractLines(receipt.data.parsed_json),
    };
  });

/**
 * Owner-editable receipt metadata. Identity columns are never sent, and the
 * receipt_identity_unchanged guard rejects any attempt to move them anyway.
 */
export const updateReceiptMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: UpdateReceiptMetaInput) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch = buildMetaPatch(data);
    if (!patch) return { ok: false as const, reason: "nothing_to_update" as const };

    const updated = await supabase
      .from("receipts")
      .update(patch)
      .eq("id", data.receiptId)
      .select("id")
      .maybeSingle();
    if (updated.error || !updated.data) {
      console.error("[receipt] meta_update_failed", updated.error?.message ?? "no row");
      return { ok: false as const, reason: "update_failed" as const };
    }
    return { ok: true as const };
  });

/**
 * Owner-only deletion: storage object first, row second. If the object cannot be
 * removed the row is kept so a retry still knows where the private image lives.
 * A linked expense survives via expenses.receipt_id ON DELETE SET NULL.
 */
export const deleteReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { receiptId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const receipt = await supabase
      .from("receipts")
      .select("id, storage_path")
      .eq("id", data.receiptId)
      .maybeSingle();
    if (receipt.error || !receipt.data) return { ok: false as const, reason: "not_found" as const };

    const removal = await removeReceiptObjects(supabase, [receipt.data.storage_path]);
    if (!removal.ok) {
      console.error("[receipt] object_delete_failed", removal.remaining);
      return { ok: false as const, reason: "storage_failed" as const };
    }

    const deleted = await supabase.from("receipts").delete().eq("id", receipt.data.id);
    if (deleted.error) {
      console.error("[receipt] row_delete_failed", deleted.error.message);
      return { ok: false as const, reason: "row_failed" as const };
    }
    return { ok: true as const };
  });
