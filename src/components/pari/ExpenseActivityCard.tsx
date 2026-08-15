import { useNavigate } from "@tanstack/react-router";

import { MoneyAmount } from "@/components/pari/MoneyAmount";
import { FxSummary } from "@/components/pari/FxSummary";
import { usePari } from "@/data/store";
import { useT } from "@/lib/i18n";
import { shortDate, timeOfDay } from "@/lib/dates";
import type { ActivityEntry, Expense } from "@/data/types";

/** History lines describe what happened to the expense, never who is in the feed. */
const HISTORY_KEYS: Record<ActivityEntry["activity_type"], string> = {
  expense_added: "activity.historyCreated",
  expense_updated: "activity.historyEdited",
  expense_deleted: "activity.historyDeleted",
  split_changed: "activity.historySplit",
  settlement_marked: "activity.historyEdited",
  group_created: "activity.historyCreated",
};

export type ExpenseActivityCardProps = {
  expense: Expense;
  /** Show the expense title + hero amount line (Activity context). */
  showHeader?: boolean;
  /** Show the group name row — only where the group is not already context. */
  showGroup?: boolean;
  /** Compact who/when history (Activity only). */
  showHistory?: boolean;
  history?: ActivityEntry[];
  showSplit?: boolean;
  showExpenseLink?: boolean;
};

/**
 * One shared expanded-expense presentation, used by both the Activity feed and
 * the Group detail list. The Group page renders the compact variant (no header,
 * no group row, no history) while keeping identical typography and spacing.
 */
export function ExpenseActivityCard({
  expense,
  showHeader = true,
  showGroup = true,
  showHistory = true,
  history = [],
  showSplit = true,
  showExpenseLink = true,
}: ExpenseActivityCardProps) {
  const pari = usePari();
  const t = useT();
  const navigate = useNavigate();

  const originalCurrency = expense.original_currency ?? expense.currency;
  const foreign = originalCurrency !== expense.currency;
  const displayMinor = expense.original_total_minor ?? expense.total_minor;
  const group = expense.group_id
    ? pari.data.groups.find((g) => g.id === expense.group_id)
    : undefined;

  return (
    <div className="space-y-2 text-[13px] text-muted-foreground">
      {showHeader ? (
        <div className="flex justify-between">
          <span className="text-foreground">{expense.title}</span>
          <MoneyAmount minor={displayMinor} currency={originalCurrency} />
        </div>
      ) : null}

      {foreign ? (
        <FxSummary
          originalCurrency={originalCurrency}
          convertedMinor={expense.total_minor}
          systemCurrency={expense.currency}
          rate={Number(expense.exchange_rate ?? 1)}
          rateDate={expense.exchange_rate_date ?? null}
          fallbackDate={expense.created_at}
        />
      ) : null}

      {showGroup && group ? (
        <div className="flex justify-between">
          <span>{t("expense.group")}</span>
          <span>{group.name}</span>
        </div>
      ) : null}

      <div className="flex justify-between">
        <span>{t("split.paidBy")}</span>
        <span>{pari.personName(expense.paid_by_person_id)}</span>
      </div>

      {showSplit ? (
        <div className="pt-1">
          {pari.expenseOriginalAllocations(expense.id).map((allocation) => (
            <div key={allocation.personId} className="flex justify-between py-0.5">
              <span>
                {pari.personName(allocation.personId)}
                {allocation.percentage != null
                  ? ` · ${allocation.percentage}%`
                  : allocation.shares != null
                    ? ` · ${allocation.shares}`
                    : ""}
              </span>
              <MoneyAmount
                minor={allocation.amountMinor}
                currency={originalCurrency}
                tone="muted"
              />
            </div>
          ))}
        </div>
      ) : null}

      {showExpenseLink ? (
        <button
          type="button"
          onClick={() =>
            navigate({ to: "/expense/$expenseId", params: { expenseId: expense.id } })
          }
          className="pt-2 text-[13px] font-medium text-foreground"
        >
          {t("expense.title")} →
        </button>
      ) : null}

      {showHistory && history.length > 1 ? (
        <div className="space-y-1.5 pt-3">
          <p className="text-[12px] uppercase tracking-wide text-muted-foreground/70">
            {t("activity.history")}
          </p>
          {history.map((event) => (
            <div key={event.id} className="flex justify-between">
              <span>
                {t(HISTORY_KEYS[event.activity_type], {
                  actor: event.actor_person_id
                    ? pari.personName(event.actor_person_id)
                    : pari.currentProfileName,
                })}
              </span>
              <span className="text-muted-foreground/80">
                {shortDate(event.created_at)} · {timeOfDay(event.created_at)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
