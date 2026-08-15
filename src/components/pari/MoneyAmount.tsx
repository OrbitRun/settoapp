import { formatMinor } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useT, type Translate } from "@/lib/i18n";

type Size = "sm" | "md" | "lg" | "hero";

const SIZES: Record<Size, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-2xl",
  hero: "text-[44px] leading-[1.05]",
};

export function MoneyAmount({
  minor,
  size = "md",
  /** Omit for system-currency (accounting) values — falls back to the profile currency. */
  currency,
  showSign = false,
  compact = true,
  tone = "default",
  className,
}: {
  minor: number;
  size?: Size;
  currency?: string | undefined;
  showSign?: boolean;
  compact?: boolean;
  tone?: "default" | "positive" | "negative" | "muted";
  className?: string;
}) {
  const toneClass =
    tone === "positive"
      ? "text-positive"
      : tone === "negative"
        ? "text-negative"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-foreground";

  return (
    <span
      className={cn(
        "tnum whitespace-nowrap font-medium tracking-[-0.02em]",
        SIZES[size],
        size === "hero" && "font-semibold tracking-[-0.035em]",
        toneClass,
        className,
      )}
    >
      {formatMinor(minor, { ...(currency ? { currency } : {}), showSign, compact })}
    </span>
  );
}

export function balanceTone(minor: number) {
  if (minor > 0) return "positive" as const;
  if (minor < 0) return "negative" as const;
  return "muted" as const;
}

export function balanceLabel(minor: number, t?: Translate) {
  const translate: Translate = t ?? ((key: string) => key);
  if (minor > 0) return translate("balance.owed");
  if (minor < 0) return translate("balance.owe");
  return translate("balance.allSettled");
}

export function BalanceDisplay({
  minor,
  label,
  hint,
  className,
}: {
  minor: number;
  label?: string;
  hint?: string;
  className?: string;
}) {
  const t = useT();
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-sm text-muted-foreground">{label ?? balanceLabel(minor, t)}</p>
      <MoneyAmount minor={Math.abs(minor)} size="hero" tone={balanceTone(minor)} />
      {hint ? <p className="pt-1 text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
