import { useRouter } from "@tanstack/react-router";
import { ChevronLeft, X } from "lucide-react";

export function FlowHeader({
  title,
  subtitle,
  onClose,
  variant = "back",
}: {
  title?: string | undefined;
  subtitle?: string | undefined;
  onClose?: (() => void) | undefined;
  variant?: "back" | "close" | undefined;
}) {
  const router = useRouter();

  return (
    <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 pb-6 pt-3">
      <button
        type="button"
        aria-label={variant === "back" ? "Back" : "Close"}
        onClick={() => (onClose ? onClose() : router.history.back())}
        className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-strong"
      >
        {variant === "back" ? (
          <ChevronLeft className="h-5 w-5" strokeWidth={1.8} />
        ) : (
          <X className="h-5 w-5" strokeWidth={1.8} />
        )}
      </button>
      <div className="min-w-0 text-center">
        {title ? <p className="truncate text-[15px] font-medium tracking-tight">{title}</p> : null}
        {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      <span className="h-10 w-10" />
    </header>
  );
}
