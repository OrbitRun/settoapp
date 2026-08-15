import { Check, Minus, Plus } from "lucide-react";

import { NumericField } from "./NumericField";
import { MoneyAmount } from "./MoneyAmount";
import { PercentageSplitEditor } from "./PercentageSplitEditor";
import { useT } from "@/lib/i18n";
import { currencyLabel, formatMinor, toMajor, toMinor } from "@/lib/money";
import {
  calculateEqualSplit,
  calculatePercentageSplit,
  calculateShareSplit,
  type Allocation,
  type SplitMode,
} from "@/lib/split";

export type SplitRule = {
  mode: SplitMode;
  percentages: Record<string, number>;
  shares: Record<string, number>;
  exact: Record<string, number>;
};

export type RulePerson = { id: string; name: string };

/** Preview allocations for a rule — always through the central engine. */
export function previewAllocations(
  rule: SplitRule,
  people: RulePerson[],
  totalMinor: number,
): Allocation[] {
  const ids = people.map((p) => p.id);
  switch (rule.mode) {
    case "percentage":
      return calculatePercentageSplit(
        totalMinor,
        ids.map((id) => ({ personId: id, percentage: rule.percentages[id] ?? 0 })),
      );
    case "shares":
      return calculateShareSplit(
        totalMinor,
        ids.map((id) => ({ personId: id, shares: rule.shares[id] ?? 1 })),
      );
    case "exact":
      return ids.map((id) => ({ personId: id, amountMinor: rule.exact[id] ?? 0 }));
    case "equal":
    default:
      return calculateEqualSplit(totalMinor, ids);
  }
}

/** A rule is only usable when percentages add to 100 and exact amounts add to the total. */
export function isRuleComplete(rule: SplitRule, people: RulePerson[], totalMinor: number): boolean {
  if (people.length === 0) return false;
  if (rule.mode === "percentage") {
    const sum = people.reduce((acc, p) => acc + (rule.percentages[p.id] ?? 0), 0);
    return Math.round(sum) === 100;
  }
  if (rule.mode === "exact") {
    const sum = people.reduce((acc, p) => acc + (rule.exact[p.id] ?? 0), 0);
    return sum === totalMinor && totalMinor > 0;
  }
  if (rule.mode === "shares") {
    return people.some((p) => (rule.shares[p.id] ?? 1) > 0);
  }
  return true;
}

/** Sensible starting values whenever the method or the people change. */
export function seedRule(rule: SplitRule, people: RulePerson[], mode: SplitMode): SplitRule {
  const ids = people.map((p) => p.id);
  const next: SplitRule = { ...rule, mode };
  if (mode === "percentage") {
    const known = ids.filter((id) => rule.percentages[id] != null);
    if (known.length !== ids.length || ids.length === 0) {
      const base = ids.length > 0 ? Math.floor(100 / ids.length) : 0;
      const rest = 100 - base * ids.length;
      next.percentages = Object.fromEntries(
        ids.map((id, index) => [id, base + (index === 0 ? rest : 0)]),
      );
    } else {
      next.percentages = Object.fromEntries(ids.map((id) => [id, rule.percentages[id] ?? 0]));
    }
  }
  if (mode === "shares") {
    next.shares = Object.fromEntries(ids.map((id) => [id, rule.shares[id] ?? 1]));
  }
  if (mode === "exact") {
    next.exact = Object.fromEntries(ids.map((id) => [id, rule.exact[id] ?? 0]));
  }
  return next;
}

/**
 * The one editor for every split method, shared by group defaults,
 * manual expenses and receipts. Calculations always come from @/lib/split.
 */
export function SplitRuleEditor({
  rule,
  people,
  totalMinor,
  onChange,
  showAmounts = true,
  currency,
}: {
  rule: SplitRule;
  people: RulePerson[];
  totalMinor: number;
  onChange: (patch: Partial<SplitRule>) => void;
  showAmounts?: boolean;
  /** Currency the amounts are in — the expense's original currency. */
  currency?: string | undefined;
}) {
  const t = useT();
  const allocations = previewAllocations(rule, people, totalMinor);
  const amountOf = (id: string) => allocations.find((a) => a.personId === id)?.amountMinor ?? 0;
  const money = (minor: number, compact = true) =>
    formatMinor(minor, { ...(currency ? { currency } : {}), compact });

  if (people.length === 0) return null;

  if (rule.mode === "equal") {
    const each = allocations[0]?.amountMinor ?? 0;
    const uniform = allocations.every((a) => a.amountMinor === each);
    if (!showAmounts || totalMinor <= 0) {
      return <p className="text-[13px] text-muted-foreground">{t("split.equalHint")}</p>;
    }
    return uniform ? (
      <div className="text-center">
        <p className="text-[26px] font-semibold tracking-[-0.03em]">
          {formatMinor(each, { compact: false })}
          <span className="ml-2 text-[15px] font-normal text-muted-foreground">
            {t("participants.each")}
          </span>
        </p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {t(people.length === 1 ? "participants.personCount" : "participants.peopleCount", {
            count: people.length,
          })}
        </p>
      </div>
    ) : (
      <div className="space-y-2.5">
        {people.map((person) => (
          <div key={person.id} className="flex items-center justify-between">
            <span className="min-w-0 flex-1 truncate text-[15px]">{person.name}</span>
            <MoneyAmount minor={amountOf(person.id)} compact={false} size="sm" />
          </div>
        ))}
      </div>
    );
  }

  if (rule.mode === "percentage") {
    return (
      <PercentageSplitEditor
        totalMinor={totalMinor}
        people={people}
        percentages={rule.percentages}
        showAmounts={showAmounts && totalMinor > 0}
        onChange={(percentages) => onChange({ percentages })}
      />
    );
  }

  if (rule.mode === "shares") {
    const totalShares = people.reduce((sum, p) => sum + (rule.shares[p.id] ?? 1), 0);
    return (
      <div className="space-y-3">
        {people.map((person) => {
          const shares = rule.shares[person.id] ?? 1;
          const set = (next: number) =>
            onChange({
              shares: { ...rule.shares, [person.id]: Math.max(0, Math.min(20, next)) },
            });
          const pct = totalShares > 0 ? (shares / totalShares) * 100 : 0;

          return (
            <div key={person.id} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-[15px]">{person.name}</span>
              {showAmounts && totalMinor > 0 ? (
                <MoneyAmount minor={amountOf(person.id)} tone="muted" size="sm" />
              ) : (
                <span className="tnum text-[13px] text-muted-foreground">
                  {pct.toFixed(pct % 1 === 0 ? 0 : 1)}%
                </span>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={`- ${person.name}`}
                  onClick={() => set(shares - 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-strong active:scale-95"
                >
                  <Minus className="h-4 w-4" strokeWidth={2} />
                </button>
                <span className="tnum w-6 text-center text-[15px] font-medium">{shares}</span>
                <button
                  type="button"
                  aria-label={`+ ${person.name}`}
                  onClick={() => set(shares + 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-strong active:scale-95"
                >
                  <Plus className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground">
          {t("split.sharesTotal", { count: totalShares })}
        </p>
      </div>
    );
  }

  // exact
  const sum = people.reduce((acc, p) => acc + (rule.exact[p.id] ?? 0), 0);
  const balanced = sum === totalMinor;

  return (
    <div className="space-y-3">
      {people.map((person) => (
        <div key={person.id} className="flex items-center gap-3">
          <span className="min-w-0 flex-1 truncate text-[15px]">{person.name}</span>
          <NumericField
            value={toMajor(rule.exact[person.id] ?? 0)}
            onChange={(next) => onChange({ exact: { ...rule.exact, [person.id]: toMinor(next) } })}
            min={0}
            ariaLabel={person.name}
            suffix={<span className="text-sm">{currencyLabel()}</span>}
            className="h-11 w-[132px] shrink-0 rounded-xl bg-surface-strong px-3"
            inputClassName="text-right text-[15px] font-medium"
          />
        </div>
      ))}
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {balanced ? (
          <>
            <Check className="h-3.5 w-3.5 text-positive" strokeWidth={2} />
            {t("split.allocated", {
              allocated: formatMinor(sum, { compact: false }),
              total: formatMinor(totalMinor, { compact: false }),
            })}
          </>
        ) : sum < totalMinor ? (
          t("split.remaining", { amount: formatMinor(totalMinor - sum, { compact: false }) })
        ) : (
          t("split.over", { amount: formatMinor(sum - totalMinor, { compact: false }) })
        )}
      </p>
    </div>
  );
}
