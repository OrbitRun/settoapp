import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { splitModeLabel } from "@/data/draft";
import type { SplitMode } from "@/lib/split";
import { BottomSheet } from "./BottomSheet";

const MODES: SplitMode[] = ["equal", "percentage", "shares", "exact"];

const HINTS: Record<SplitMode, string> = {
  equal: "Everyone pays the same",
  percentage: "For example 60 / 40",
  shares: "Give some people a bigger share",
  exact: "Type each amount yourself",
};

export function SplitSelector({
  mode,
  onChange,
}: {
  mode: SplitMode;
  onChange: (mode: SplitMode) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        {splitModeLabel[mode]}
        <ChevronDown className="h-4 w-4" strokeWidth={1.8} />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="How to split">
        <div className="space-y-1">
          {MODES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-2xl px-4 py-4 text-left transition-colors hover:bg-surface-strong/70"
            >
              <span>
                <span className="block text-[15px] font-medium tracking-tight">
                  {splitModeLabel[option]}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {HINTS[option]}
                </span>
              </span>
              {mode === option ? (
                <Check className="h-4 w-4 text-positive" strokeWidth={2} />
              ) : null}
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
