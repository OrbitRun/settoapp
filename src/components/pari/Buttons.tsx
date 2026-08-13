import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode };

const base =
  "inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-medium transition-all duration-200 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-40";

export function PrimaryButton({ className, children, ...props }: Props) {
  return (
    <button
      {...props}
      className={cn(base, "h-14 bg-primary text-primary-foreground hover:opacity-95", className)}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ className, children, ...props }: Props) {
  return (
    <button
      {...props}
      className={cn(
        base,
        "h-14 bg-surface-strong text-foreground hover:bg-surface-strong/70",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function QuietButton({ className, children, ...props }: Props) {
  return (
    <button
      {...props}
      className={cn(
        base,
        "h-11 w-auto px-3 text-sm text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}
