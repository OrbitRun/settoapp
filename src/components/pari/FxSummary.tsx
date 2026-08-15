import { fxDate } from "@/lib/dates";
import { useT } from "@/lib/i18n";
import { formatMinorIn } from "@/lib/money";
import { cn } from "@/lib/utils";

export function FxSummary({
  originalCurrency,
  convertedMinor,
  systemCurrency,
  rate,
  rateDate,
  fallbackDate,
  className,
}: {
  originalCurrency: string;
  convertedMinor: number;
  systemCurrency: string;
  rate: number;
  rateDate: string | null;
  fallbackDate?: string;
  className?: string;
}) {
  const t = useT();
  const dateIso = rateDate ? `${rateDate}T12:00:00.000Z` : fallbackDate;

  return (
    <div className={cn("space-y-0.5", className)}>
      <p className="text-[15px] text-muted-foreground">
        {t("currency.bookedAs", {
          amount: formatMinorIn(convertedMinor, systemCurrency, { compact: false }),
        })}
      </p>
      <p className="text-[13px] text-muted-foreground">
        <span className="tnum inline-block">
          {t("currency.rateLine", {
            base: originalCurrency,
            rate: rate.toFixed(4).replace(".", ","),
            quote: systemCurrency,
            date: dateIso ? fxDate(dateIso) : "—",
          })}
        </span>
      </p>
    </div>
  );
}
