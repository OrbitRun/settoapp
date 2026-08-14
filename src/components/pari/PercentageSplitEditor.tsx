import { Check } from "lucide-react";

import { calculatePercentageSplit } from "@/lib/split";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";
import { MoneyAmount } from "./MoneyAmount";
import { NumericField } from "./NumericField";

export function PercentageSplitEditor({
  totalMinor,
  people,
  percentages,
  onChange,
  showAmounts = true,
}: {
  totalMinor: number;
  people: { id: string; name: string }[];
  percentages: Record<string, number>;
  onChange: (personId: string, percentage: number) => void;
  showAmounts?: boolean;
}) {
  const t = useT();
  const sum = people.reduce((acc, person) => acc + (percentages[person.id] ?? 0), 0);
  const allocations = calculatePercentageSplit(
    totalMinor,
    people.map((person) => ({ personId: person.id, percentage: percentages[person.id] ?? 0 })),
  );
  const balanced = Math.round(sum) === 100;
  const pair = people.length === 2;

  // Committed only (blur / Enter / Done) — never while typing.
  const commit = (personId: string, value: number) => {
    const next = Math.min(100, Math.max(0, value));
    onChange(personId, next);
    if (pair) {
      const other = people.find((person) => person.id !== personId);
      if (other) onChange(other.id, Math.round((100 - next) * 100) / 100);
    }
  };


  const round = (value: number) => value.toFixed(value % 1 === 0 ? 0 : 1);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {people.map((person) => {
          const value = percentages[person.id] ?? 0;
          const amount =
            allocations.find((a) => a.personId === person.id)?.amountMinor ?? 0;

          return (
            <div key={person.id} className="flex items-center gap-3">
              <Avatar name={person.name} size="sm" />
              <span className="min-w-0 flex-1 truncate text-[15px]">{person.name}</span>
              {showAmounts ? (
                <MoneyAmount
                  minor={amount}
                  tone="muted"
                  size="sm"
                  className="w-24 shrink-0 text-right"
                />
              ) : null}
              <NumericField
                value={value}
                onChange={(next) => set(person.id, next)}
                min={0}
                max={100}
                decimals={1}
                ariaLabel={`${person.name} percentage`}
                suffix={<span className="text-sm">%</span>}
                className="h-11 w-[92px] shrink-0 rounded-xl bg-surface-strong px-3"
                inputClassName="text-right text-[15px] font-medium"
              />
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <div className="h-1 w-full overflow-hidden rounded-full bg-surface-strong">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              balanced ? "bg-positive" : "bg-muted-foreground/50",
            )}
            style={{ width: `${Math.min(100, Math.max(0, sum))}%` }}
          />
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {balanced ? (
            <>
              <Check className="h-3.5 w-3.5 text-positive" strokeWidth={2} />
              {t("split.percentTotalOk")}
            </>
          ) : (
            <>
              {t("split.percentTotal", { value: round(sum) })} ·{" "}
              {sum < 100
                ? t("split.percentRemaining", { value: round(100 - sum) })
                : t("split.percentOver", { value: round(sum - 100) })}
            </>
          )}
        </p>
      </div>
    </div>
  );
}
