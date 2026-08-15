import { useState } from "react";
import { ChevronDown, Settings2 } from "lucide-react";

import { CurrencySheet } from "@/components/pari/CurrencySheet";
import { FxSummary } from "@/components/pari/FxSummary";
import { NumericField } from "@/components/pari/NumericField";
import type { MoneyLock } from "@/hooks/useMoneyLock";
import { useT } from "@/lib/i18n";
import { currencyLabel, formatMinorIn, toMajor, toMinor } from "@/lib/money";

/**
 * Currency of the purchase plus the conversion that will be locked onto the
 * expense. Everything above this panel stays in the original currency.
 */
export function CurrencyPanel({
  lock,
  onCurrencyChange,
  detectedNote,
}: {
  lock: MoneyLock;
  onCurrencyChange: (currency: string) => void;
  detectedNote?: string | undefined;
}) {
  const t = useT();
  const [picking, setPicking] = useState(false);
  const [tweaking, setTweaking] = useState(false);

  return (
    <div className="rounded-3xl bg-surface p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-[13px] text-muted-foreground">{t("currency.expenseCurrency")}</p>
          <p className="mt-0.5 text-[15px] font-medium">
            {lock.currency}
            <span className="ml-2 font-normal text-muted-foreground">
              {currencyLabel(lock.currency)}
            </span>
          </p>
          {detectedNote ? (
            <p className="mt-1 text-xs text-muted-foreground">{detectedNote}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="flex items-center gap-1 rounded-full bg-surface-strong px-3.5 py-2 text-[13px]"
        >
          {t("currency.change")}
          <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.8} />
        </button>
      </div>

      {lock.foreign ? (
        <div className="mt-4 border-t border-border/60 pt-3">
          {lock.loading ? (
            <p className="text-sm text-muted-foreground">{t("currency.rateLoading")}</p>
          ) : lock.failed && lock.rate == null ? (
            <p className="text-sm text-muted-foreground">{t("currency.rateFailed")}</p>
          ) : (
            <FxSummary
              originalCurrency={lock.currency}
              convertedMinor={lock.convertedMinor ?? 0}
              systemCurrency={lock.systemCurrency}
              rate={lock.rate ?? 1}
              rateDate={lock.rateDate}
            />
          )}

          <button
            type="button"
            onClick={() => setTweaking((prev) => !prev)}
            className="mt-3 flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <Settings2 className="h-3.5 w-3.5" strokeWidth={1.8} />
            {t("currency.manualRate")}
          </button>

          {tweaking ? (
            <div className="mt-3 space-y-2">
              <NumericField
                value={lock.manualRate ?? lock.rate ?? 0}
                onChange={(next) => lock.setManualRate(next > 0 ? next : null)}
                min={0}
                decimals={4}
                ariaLabel={t("currency.manualRate")}
                suffix={<span className="text-xs">{lock.systemCurrency}</span>}
                className="h-12 w-full rounded-2xl bg-surface-strong px-4"
                inputClassName="text-[15px]"
              />
              <NumericField
                value={toMajor(lock.cardMinor ?? 0)}
                onChange={(next) => lock.setCardMinor(next > 0 ? toMinor(next) : null)}
                min={0}
                ariaLabel={t("currency.cardAmount")}
                suffix={<span className="text-xs">{currencyLabel(lock.systemCurrency)}</span>}
                className="h-12 w-full rounded-2xl bg-surface-strong px-4"
                inputClassName="text-[15px]"
              />
              <p className="px-1 text-xs text-muted-foreground">{t("currency.cardAmountHint")}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <CurrencySheet
        open={picking}
        value={lock.currency}
        onClose={() => setPicking(false)}
        onSelect={onCurrencyChange}
      />
    </div>
  );
}
