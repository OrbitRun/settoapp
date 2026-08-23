import type { ParsedReceiptPayload } from "./parseReceipt.functions";

/**
 * The normalized JPEG that was sent to the OCR service, kept in memory only.
 *
 * It deliberately never touches localStorage (the guest draft is persisted there)
 * and never leaves the tab until an authenticated user saves the expense.
 */
export type ReceiptCapture = {
  /** Exactly the bytes OCR read — no second, quality-changing encode. */
  dataUrl: string;
  mimeType: string;
  byteSize: number;
  capturedAtIso: string;
  payload: ParsedReceiptPayload;
};

let pending: ReceiptCapture | null = null;

export const MAX_RECEIPT_BYTES = 6 * 1024 * 1024;

export function base64ByteSize(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return 0;
  const body = dataUrl.slice(comma + 1);
  const padding = body.endsWith("==") ? 2 : body.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((body.length * 3) / 4) - padding);
}

export function setPendingCapture(dataUrl: string, payload: ParsedReceiptPayload) {
  const mimeType = dataUrl.slice(5, Math.max(5, dataUrl.indexOf(";")));
  pending = {
    dataUrl,
    mimeType,
    byteSize: base64ByteSize(dataUrl),
    capturedAtIso: new Date().toISOString(),
    payload,
  };
}

export function getPendingCapture(): ReceiptCapture | null {
  return pending;
}

export function clearPendingCapture() {
  pending = null;
}

/** Client-side gate: JPEG, non-empty, within the archive size budget. */
export function captureIsArchivable(capture: ReceiptCapture | null): capture is ReceiptCapture {
  if (!capture) return false;
  if (capture.mimeType !== "image/jpeg") return false;
  if (capture.byteSize <= 0) return false;
  return capture.byteSize <= MAX_RECEIPT_BYTES;
}
