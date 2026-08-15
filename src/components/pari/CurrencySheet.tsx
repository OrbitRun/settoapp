import { Check } from "lucide-react";

import { BottomSheet } from "@/components/pari/BottomSheet";
import { CURRENCY_OPTIONS, currencyLabel } from "@/lib/money";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function CurrencySheet({
  open,
  value,
  onClose,
  onSelect,
}: {
  open: boolean;
  value: string;
  onClose: () => void;
  onSelect: (currency: string) => void;
}) {
  const t = useT();
  const options = CURRENCY_OPTIONS.includes(value as (typeof CURRENCY_OPTIONS)[number])
    ? [...CURRENCY_OPTIONS]
    : [value, ...CURRENCY_OPTIONS];

  return (
    <BottomSheet open={open} onClose={onClose} title={t("currency.pick")}>
      <div className="space-y-1">
        {options.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => {
              onSelect(code);
              onClose();
            }}
            className={cn(
              "flex w-full items-center justify-between rounded-2xl px-4 py-3.5 text-left text-[15px] transition-colors",
              code === value ? "bg-surface-strong" : "hover:bg-surface-strong/60",
            )}
          >
            <span>
              {code}
              <span className="ml-2 text-muted-foreground">{currencyLabel(code)}</span>
            </span>
            {code === value ? <Check className="h-4 w-4" strokeWidth={2} /> : null}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
