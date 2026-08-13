import { Check, Lock } from "lucide-react";

import { formatMinor } from "@/lib/money";
import { cn } from "@/lib/utils";

export function ReceiptItemRow({
  name,
  amountMinor,
  quantity = 1,
  selected = false,
  selectable = false,
  isPrivate = false,
  detail,
  onClick,
  right,
}: {
  name: string;
  amountMinor: number;
  quantity?: number;
  selected?: boolean;
  selectable?: boolean;
  isPrivate?: boolean;
  detail?: string | undefined;
  onClick?: (() => void) | undefined;
  right?: React.ReactNode;
}) {
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={cn(
        "grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors",
        onClick && "hover:bg-surface-strong/60",
        selected && "bg-surface-strong",
        isPrivate && "opacity-55",
      )}
    >
      {selectable ? (
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full transition-colors",
            selected ? "bg-primary text-primary-foreground" : "bg-surface-strong",
          )}
        >
          {selected ? <Check className="h-3.5 w-3.5" strokeWidth={2.4} /> : null}
        </span>
      ) : (
        <span className="w-0" />
      )}

      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[15px] tracking-tight">{name}</span>
          {isPrivate ? (
            <Lock className="h-3 w-3 shrink-0 text-muted-foreground" strokeWidth={1.8} />
          ) : null}
        </span>
        {quantity > 1 || detail ? (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {quantity > 1 ? `${quantity} ×` : ""} {detail ?? ""}
          </span>
        ) : null}
      </span>

      <span className="tnum shrink-0 text-[15px] font-medium">
        {right ?? formatMinor(amountMinor * quantity, { currency: "" }).trim()}
      </span>
    </Tag>
  );
}
