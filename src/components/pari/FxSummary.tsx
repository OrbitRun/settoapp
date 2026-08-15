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
    <div className={cn("w-full space-y-0.5 text-left", className)}>
      <p className="text-[15px] text-muted-foreground">
        {t("currency.bookedAs", {
          amount: formatMinorIn(convertedMinor, systemCurrency, { compact: false }),
        })}
      </p>
      <p className="tnum whitespace-nowrap text-[13px] text-muted-foreground">
        {t("currency.rateLine", {
          base: originalCurrency,
          rate: rate.toFixed(4).replace(".", ","),
          quote: systemCurrency,
          date: dateIso ? fxDate(dateIso) : "—",
        })}
      </p>
    </div>
  );
}
