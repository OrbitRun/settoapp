import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { shortDate } from "@/lib/dates";
import { formatMinor, formatMinorIn } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useI18n, useT } from "@/lib/i18n";
import { AvatarStack } from "./Avatar";
import { MoneyAmount, balanceTone } from "./MoneyAmount";

export function GroupRow({
  id,
  name,
  memberNames,
  balanceMinor,
}: {
  id: string;
  name: string;
  memberNames: string[];
  balanceMinor: number;
}) {
  const t = useT();
  return (
    <Link
      to="/groups/$groupId"
      params={{ groupId: id }}
      className="group flex items-center gap-4 rounded-2xl px-4 py-4 transition-colors hover:bg-surface-strong/60"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium tracking-tight">{name}</p>
        <div className="mt-2 flex items-center gap-2">
          <AvatarStack names={memberNames} />
          <span className="text-xs text-muted-foreground">
            {t("common.memberCount", { count: memberNames.length })}
          </span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs text-muted-foreground">
          {balanceMinor > 0
            ? t("balance.owed")
            : balanceMinor < 0
              ? t("balance.owe")
              : t("balance.settled")}
        </p>
        <MoneyAmount
          minor={Math.abs(balanceMinor)}
          tone={balanceTone(balanceMinor)}
          className="mt-0.5 block"
        />
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" strokeWidth={1.6} />
    </Link>
  );
}

export function ExpenseRow({
  title,
  subtitle,
  amountMinor,
  currency,
  originalAmountMinor,
  originalCurrency,
  dateIso,
  expenseId,
  onClick,
  className,
}: {
  title: string;
  subtitle: string;
  /** Amount in system currency — what the ledger and balances use. */
  amountMinor: number;
  currency?: string | undefined;
  /** Set only for foreign-currency expenses; shown as context in the subtitle. */
  originalAmountMinor?: number | undefined;
  originalCurrency?: string | undefined;
  dateIso?: string;
  /** Makes the row open the canonical expense detail screen. */
  expenseId?: string | undefined;
  onClick?: () => void;
  className?: string;
}) {
  const foreign =
    originalCurrency != null && originalAmountMinor != null && originalCurrency !== currency;

  const inner = (
    <>
      <div className="min-w-0">
        <p className="truncate text-[15px] font-medium tracking-tight">{title}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {dateIso ? `${shortDate(dateIso)} · ` : ""}
          {foreign ? `${formatMinorIn(originalAmountMinor, originalCurrency)} · ` : ""}
          {subtitle}
        </p>
      </div>
      <MoneyAmount minor={amountMinor} currency={currency} className="shrink-0" />
    </>
  );

  const shell = cn(
    "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl px-4 py-3.5 text-left transition-colors",
    (onClick || expenseId) && "hover:bg-surface-strong/60",
    className,
  );

  if (expenseId) {
    return (
      <Link to="/expense/$expenseId" params={{ expenseId }} className={shell}>
        {inner}
      </Link>
    );
  }

  const Tag = onClick ? "button" : "div";
  return (
    <Tag {...(onClick ? { type: "button" as const, onClick } : {})} className={shell}>
      {inner}
    </Tag>
  );
}

export function ActivityRow({
  actor,
  action,
  subject,
  amountMinor,
  timeIso,
}: {
  actor: string;
  action: string;
  subject?: string | undefined;
  amountMinor?: number | undefined;
  timeIso: string;
}) {
  const { locale } = useI18n();
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-[15px] tracking-tight">
          <span className="font-medium">{actor}</span>{" "}
          <span className="text-muted-foreground">{action}</span>
        </p>
        {subject ? (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {subject}
            {amountMinor != null ? ` · ${formatMinor(amountMinor)}` : ""}
          </p>
        ) : null}
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">
        {new Date(timeIso).toLocaleTimeString(locale, {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </div>
  );
}
