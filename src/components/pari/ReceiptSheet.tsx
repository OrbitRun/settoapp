import { useEffect, useState } from "react";

import { BottomSheet } from "@/components/pari/BottomSheet";
import { SecondaryButton } from "@/components/pari/Buttons";
import { getReceiptSignedUrl } from "@/lib/receipt.functions";
import { formatMinorIn } from "@/lib/money";
import { shortDate } from "@/lib/dates";
import { useT } from "@/lib/i18n";

export type ReceiptSummary = {
  id: string;
  merchantName: string | null;
  purchaseDate: string | null;
  currency: string | null;
  totalMinor: number | null;
  note: string | null;
  warrantyExpiresAt: string | null;
};

export function ReceiptSheet({
  open,
  onClose,
  receipt,
}: {
  open: boolean;
  onClose: () => void;
  receipt: ReceiptSummary;
}) {
  const t = useT();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) {
      // A signed URL is short-lived and never kept around.
      setUrl(null);
      setFailed(false);
      return;
    }
    let active = true;
    void getReceiptSignedUrl({ data: { receiptId: receipt.id } })
      .then((result) => {
        if (!active) return;
        if (result?.url) setUrl(result.url);
        else setFailed(true);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [open, receipt.id]);

  return (
    <BottomSheet open={open} onClose={onClose} title={t("receipt.viewTitle")}>
      <div className="space-y-4 px-1">
        <div className="overflow-hidden rounded-2xl bg-surface-strong">
          {url ? (
            <img src={url} alt={t("receipt.viewTitle")} className="max-h-[52svh] w-full object-contain" />
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              {failed ? t("receipt.viewFailed") : t("common.loading")}
            </div>
          )}
        </div>

        <div className="space-y-1 text-sm">
          {receipt.merchantName ? (
            <p className="text-[15px] font-medium tracking-tight">{receipt.merchantName}</p>
          ) : null}
          {receipt.purchaseDate ? (
            <p className="text-muted-foreground">{shortDate(receipt.purchaseDate)}</p>
          ) : null}
          {receipt.totalMinor != null ? (
            <p className="tnum text-muted-foreground">
              {formatMinorIn(receipt.totalMinor, receipt.currency ?? "DKK", { compact: false })}
            </p>
          ) : null}
          {receipt.note ? <p className="text-muted-foreground">{receipt.note}</p> : null}
          {receipt.warrantyExpiresAt ? (
            <p className="text-muted-foreground">
              {t("receipt.warrantyUntil", { date: shortDate(receipt.warrantyExpiresAt) })}
            </p>
          ) : null}
        </div>

        <SecondaryButton onClick={onClose}>{t("common.close")}</SecondaryButton>
      </div>
    </BottomSheet>
  );
}
