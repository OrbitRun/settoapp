import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { BottomSheet } from "@/components/pari/BottomSheet";
import { PrimaryButton, SecondaryButton } from "@/components/pari/Buttons";
import {
  deleteReceipt,
  getReceiptDetail,
  updateReceiptMeta,
} from "@/lib/receipt.functions";
import { formatMinorIn } from "@/lib/money";
import { shortDate } from "@/lib/dates";
import { useT } from "@/lib/i18n";

type Detail = Awaited<ReturnType<typeof getReceiptDetail>>;

export function ReceiptDetailSheet({
  receiptId,
  onClose,
  onChanged,
}: {
  receiptId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useT();
  const [detail, setDetail] = useState<Detail>(null);
  const [note, setNote] = useState("");
  const [warranty, setWarranty] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!receiptId) {
      setDetail(null);
      setConfirmDelete(false);
      return;
    }
    let active = true;
    void getReceiptDetail({ data: { receiptId } })
      .then((result) => {
        if (!active) return;
        setDetail(result);
        setNote(result?.note ?? "");
        setWarranty(result?.warrantyExpiresAt ?? "");
      })
      .catch(() => active && setDetail(null));
    return () => {
      active = false;
    };
  }, [receiptId]);

  const save = async () => {
    if (!receiptId || busy) return;
    setBusy(true);
    try {
      const result = await updateReceiptMeta({
        data: { receiptId, note, warrantyExpiresAt: warranty },
      });
      if (!result.ok) {
        toast.error(t("receipt.updateFailed"));
        return;
      }
      toast.success(t("common.save"));
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!receiptId || busy) return;
    setBusy(true);
    try {
      const result = await deleteReceipt({ data: { receiptId } });
      if (!result.ok) {
        toast.error(t("receipt.deleteFailed"));
        return;
      }
      toast.success(t("receipt.deleted"));
      onChanged();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={receiptId !== null} onClose={onClose} title={t("receipt.viewTitle")}>
      <div className="space-y-5 px-1">
        <div className="overflow-hidden rounded-2xl bg-surface-strong">
          {detail?.imageUrl ? (
            <img
              src={detail.imageUrl}
              alt={t("receipt.viewTitle")}
              className="max-h-[46svh] w-full object-contain"
            />
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              {detail === null ? t("common.loading") : t("receipt.viewFailed")}
            </div>
          )}
        </div>

        {detail ? (
          <>
            <div className="space-y-1 text-sm">
              {detail.merchantName ? (
                <p className="text-[15px] font-medium tracking-tight">{detail.merchantName}</p>
              ) : null}
              {detail.purchaseDate ? (
                <p className="text-muted-foreground">{shortDate(detail.purchaseDate)}</p>
              ) : null}
              {detail.totalMinor != null ? (
                <p className="tnum text-muted-foreground">
                  {formatMinorIn(detail.totalMinor, detail.currency ?? "DKK", { compact: false })}
                </p>
              ) : null}
            </div>

            {detail.lines.length > 0 ? (
              <div className="overflow-hidden rounded-2xl bg-surface-strong">
                {detail.lines.map((line, index) => (
                  <div
                    key={`${line.name}-${index}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <span className="min-w-0 truncate">{line.name}</span>
                    <span className="tnum shrink-0 text-muted-foreground">
                      {line.unitPriceMinor != null
                        ? formatMinorIn(
                            Math.round(line.unitPriceMinor * (line.quantity ?? 1)),
                            detail.currency ?? "DKK",
                            { compact: false },
                          )
                        : ""}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="space-y-3">
              <label className="block space-y-1.5">
                <span className="text-[13px] text-muted-foreground">{t("receipt.note")}</span>
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className="h-14 w-full rounded-2xl bg-surface-strong px-4 text-[15px] outline-none ring-accent/40 focus:ring-2"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[13px] text-muted-foreground">{t("receipt.warranty")}</span>
                <input
                  type="date"
                  value={warranty}
                  onChange={(event) => setWarranty(event.target.value)}
                  className="h-14 w-full rounded-2xl bg-surface-strong px-4 text-[15px] outline-none ring-accent/40 focus:ring-2"
                />
              </label>
            </div>

            <div className="space-y-2">
              <PrimaryButton onClick={save} disabled={busy}>
                {t("common.save")}
              </PrimaryButton>
              {detail.linkedExpenseId ? (
                <Link
                  to="/expense/$expenseId"
                  params={{ expenseId: detail.linkedExpenseId }}
                  onClick={onClose}
                  className="flex h-14 w-full items-center justify-center rounded-2xl bg-surface-strong text-[15px] font-medium"
                >
                  {t("receipt.openExpense")}
                </Link>
              ) : null}
              {confirmDelete ? (
                <>
                  <p className="pt-1 text-center text-sm text-muted-foreground">
                    {t("receipt.deleteConfirm")}
                  </p>
                  <button
                    type="button"
                    onClick={remove}
                    disabled={busy}
                    className="h-14 w-full rounded-2xl bg-surface-strong text-[15px] font-medium text-negative"
                  >
                    {t("receipt.delete")}
                  </button>
                  <SecondaryButton onClick={() => setConfirmDelete(false)} disabled={busy}>
                    {t("common.cancel")}
                  </SecondaryButton>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="h-14 w-full rounded-2xl text-[15px] text-negative"
                >
                  {t("receipt.delete")}
                </button>
              )}
            </div>
          </>
        ) : null}
      </div>
    </BottomSheet>
  );
}
