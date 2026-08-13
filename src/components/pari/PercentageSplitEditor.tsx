import { calculatePercentageSplit } from "@/lib/split";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";
import { MoneyAmount } from "./MoneyAmount";

export function PercentageSplitEditor({
  totalMinor,
  people,
  percentages,
  onChange,
}: {
  totalMinor: number;
  people: { id: string; name: string }[];
  percentages: Record<string, number>;
  onChange: (personId: string, percentage: number) => void;
}) {
  const sum = people.reduce((acc, person) => acc + (percentages[person.id] ?? 0), 0);
  const allocations = calculatePercentageSplit(
    totalMinor,
    people.map((person) => ({ personId: person.id, percentage: percentages[person.id] ?? 0 })),
  );
  const balanced = Math.round(sum) === 100;

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
              <MoneyAmount
                minor={amount}
                tone="muted"
                size="sm"
                className="w-24 shrink-0 text-right"
              />
              <div className="flex h-11 w-[92px] shrink-0 items-center rounded-xl bg-surface-strong px-3">
                <input
                  inputMode="decimal"
                  value={value === 0 ? "" : String(value)}
                  placeholder="0"
                  onChange={(event) => {
                    const next = Number(event.target.value.replace(",", "."));
                    onChange(person.id, Number.isFinite(next) ? next : 0);
                  }}
                  className="tnum w-full bg-transparent text-right text-[15px] font-medium outline-none"
                />
                <span className="ml-1 text-sm text-muted-foreground">%</span>
              </div>
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
        <p className="text-xs text-muted-foreground">
          {balanced
            ? "Adds up to 100%"
            : sum < 100
              ? `${(100 - sum).toFixed(sum % 1 === 0 ? 0 : 1)}% left to assign`
              : `${(sum - 100).toFixed(sum % 1 === 0 ? 0 : 1)}% too much`}
        </p>
      </div>
    </div>
  );
}
