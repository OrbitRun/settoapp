import { useEffect, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export function BottomSheet({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-[oklch(0.20_0.03_180_/_0.35)] backdrop-blur-[2px] animate-in fade-in duration-200"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "animate-sheet-in relative w-full max-w-[430px] rounded-t-[28px] bg-surface px-6 pb-10 pt-3 shadow-sheet",
          className,
        )}
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-hairline" />
        {title ? (
          <div className="mb-5 space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
