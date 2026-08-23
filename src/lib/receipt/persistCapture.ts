import { saveReceiptForExpense } from "@/lib/receipt.functions";
import { captureIsArchivable, clearPendingCapture, getPendingCapture } from "./receiptCapture";
import type { SplitDraft } from "@/data/draft";

export type ReceiptSaveOutcome = "saved" | "skipped" | "failed";

/**
 * Archives the in-memory normalized receipt for a just-created expense.
 * Guests never reach this path; failures are non-fatal — the expense stays saved.
 */
export async function persistCapturedReceipt(
  expenseId: string,
  draft: SplitDraft,
): Promise<ReceiptSaveOutcome> {
  const capture = getPendingCapture();
  if (!capture) return "skipped";
  if (!captureIsArchivable(capture)) {
    clearPendingCapture();
    return "failed";
  }

  try {
    const result = await saveReceiptForExpense({
      data: {
        expenseId,
        dataUrl: capture.dataUrl,
        merchantName: draft.merchant ?? capture.payload.merchant,
        purchaseDate: (draft.dateIso ?? capture.payload.dateIso)?.slice(0, 10) ?? null,
        currency: draft.currency ?? capture.payload.currency,
        totalMinor: capture.payload.totalMinor || draft.amountMinor,
        merchantRaw: draft.merchantRaw ?? null,
        merchantAddress: draft.merchantAddress ?? [],
        capturedAtIso: capture.capturedAtIso,
        parsed: capture.payload,
      },
    });
    clearPendingCapture();
    return result.ok ? "saved" : "failed";
  } catch {
    clearPendingCapture();
    return "failed";
  }
}
