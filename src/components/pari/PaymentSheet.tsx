import { useEffect, useState } from "react";

import { BottomSheet } from "@/components/pari/BottomSheet";
import { NumericField } from "@/components/pari/NumericField";
import { useT } from "@/lib/i18n";
import { currencyLabel, formatMinor, toMajor, toMinor } from "@/lib/money";

/**
 * Registers a settlement payment. Prefilled with the full outstanding amount so
 * a normal full settlement stays a two-tap flow; editing the amount turns it
 * into a partial payment.
 */
export function PaymentSheet({
  open,
  onClose,
  fromName,
  toName,
  outstandingMinor,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  fromName: string;
  toName: string;
  outstandingMinor: number;
  onConfirm: (amountMinor: number, note: string) => void | Promise<void>;
}) {
  const t = useT();
  const [major, setMajor] = useState(() => toMajor(outstandingMinor));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMajor(toMajor(outstandingMinor));
    setNote("");
    setBusy(false);
  }, [open, outstandingMinor]);

  const amountMinor = toMinor(major);
  const remaining = outstandingMinor - amountMinor;
  const error =
    amountMinor <= 0
      ? t("settle.mustBePositive")
      : amountMinor > outstandingMinor
        ? t("settle.tooMuch")
        : null;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t("settle.registerPayment")}
      description={t("settle.pays", { from: fromName, to: toName })}
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-[13px] text-muted-foreground">{t("settle.amount")}</p>
          <div className="flex items-center rounded-2xl bg-surface-strong px-4 py-3">
            <NumericField
              value={major}
              onChange={setMajor}
              min={0}
              decimals={2}
              showZero
              ariaLabel={t("settle.amount")}
              inputClassName="text-[22px] font-semibold tracking-tight"
              suffix={<span className="text-[15px]">{currencyLabel()}</span>}
            />
          </div>
          {error ? <p className="mt-2 text-[13px] text-destructive">{error}</p> : null}
        </div>

        <div className="flex items-center justify-between text-[13px] text-muted-foreground">
          <span>{t("settle.outstanding")}</span>
          <span className="tnum">{formatMinor(outstandingMinor)}</span>
        </div>

        {!error && remaining > 0 ? (
          <div className="flex items-center justify-between text-[13px] text-muted-foreground">
            <span>{t("settle.afterPayment")}</span>
            <span className="tnum">
              {t("settle.remainingAfter", { amount: formatMinor(remaining) })}
            </span>
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-[13px] text-muted-foreground">{t("settle.note")}</p>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t("settle.notePlaceholder")}
            className="h-12 w-full rounded-2xl bg-surface-strong px-4 text-[15px] outline-none placeholder:text-muted-foreground/50"
          />
        </div>

        <button
          type="button"
          disabled={Boolean(error) || busy}
          onClick={async () => {
            if (error || busy) return;
            setBusy(true);
            await onConfirm(amountMinor, note.trim());
          }}
          className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-[15px] font-medium text-primary-foreground disabled:opacity-50"
        >
          {t("settle.registerPayment")}
        </button>
      </div>
    </BottomSheet>
  );
}
