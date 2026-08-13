import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";

export function PersonChip({
  name,
  selected = false,
  onClick,
  detail,
  className,
}: {
  name: string;
  selected?: boolean;
  onClick?: () => void;
  detail?: string;
  className?: string;
}) {
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={cn(
        "inline-flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-sm font-medium transition-all duration-200",
        onClick && "active:scale-[0.97]",
        selected
          ? "bg-primary text-primary-foreground"
          : "bg-surface-strong text-foreground",
        className,
      )}
    >
      {selected ? (
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
        </span>
      ) : (
        <Avatar name={name} size="sm" className="h-7 w-7" />
      )}
      <span className="truncate">{name}</span>
      {detail ? (
        <span className={cn("tnum text-xs", selected ? "opacity-70" : "text-muted-foreground")}>
          {detail}
        </span>
      ) : null}
    </Tag>
  );
}
