import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { shortDate } from "@/lib/dates";
import { formatMinor } from "@/lib/money";
import { cn } from "@/lib/utils";
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
            {memberNames.length} members
          </span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs text-muted-foreground">
          {balanceMinor > 0 ? "You are owed" : balanceMinor < 0 ? "You owe" : "Settled"}
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
  dateIso,
  onClick,
  className,
}: {
  title: string;
  subtitle: string;
  amountMinor: number;
  dateIso?: string;
  onClick?: () => void;
  className?: string;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={cn(
        "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl px-4 py-3.5 text-left transition-colors",
        onClick && "hover:bg-surface-strong/60",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-[15px] font-medium tracking-tight">{title}</p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {dateIso ? `${shortDate(dateIso)} · ` : ""}
          {subtitle}
        </p>
      </div>
      <MoneyAmount minor={amountMinor} className="shrink-0" />
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
        {new Date(timeIso).toLocaleTimeString("da-DK", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </div>
  );
}
