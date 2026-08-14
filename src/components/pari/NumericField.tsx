import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Mobile-first numeric input.
 * - decimal keyboard
 * - selects the whole value on focus (cursor-at-end fallback)
 * - allows a temporary empty state while typing
 * - prefix/suffix are separate UI, never part of the editable value
 */
export function NumericField({
  value,
  onChange,
  onCommit,
  min,
  max,
  decimals = 2,
  placeholder = "0",
  prefix,
  suffix,
  ariaLabel,
  autoFocus,
  className,
  style,
  inputClassName,
  format,
  showZero = false,
  commitOnly = false,
}: {
  value: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  min?: number;
  max?: number;
  decimals?: number;
  placeholder?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  ariaLabel?: string;
  autoFocus?: boolean;
  className?: string;
  style?: React.CSSProperties;
  inputClassName?: string;
  /** Optional display formatting applied on blur only. */
  format?: (value: number) => string;
  /** Render a real "0" at rest instead of leaving the field empty. */
  showZero?: boolean;
  /** Never report while typing — only on blur/Enter, through onCommit. */
  commitOnly?: boolean;
}) {


  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => toText(value, format, showZero));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (focused) return;
    setText(toText(value, format, showZero));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused]);

  const clamp = (next: number) => {
    let out = next;
    if (typeof min === "number") out = Math.max(min, out);
    if (typeof max === "number") out = Math.min(max, out);
    return out;
  };

  const parse = (raw: string) => {
    const cleaned = raw.replace(/[^\d.,-]/g, "").replace(",", ".");
    const parsed = Number.parseFloat(cleaned);
    if (!Number.isFinite(parsed)) return 0;
    const factor = 10 ** decimals;
    return Math.round(parsed * factor) / factor;
  };

  return (
    <div className={cn("flex items-center gap-1", className)} style={style}>
      {prefix ? <span className="shrink-0 text-muted-foreground">{prefix}</span> : null}
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        inputMode="decimal"
        enterKeyHint="done"
        aria-label={ariaLabel}
        value={text}
        placeholder={placeholder}
        onFocus={(event) => {
          setFocused(true);
          setText(value === 0 ? "" : stripFormat(event.target.value));
          selectAll(event.target);
        }}
        onMouseUp={(event) => {
          // Keep the select-all instead of the browser placing a caret.
          event.preventDefault();
          selectAll(event.currentTarget);
        }}
        onTouchEnd={(event) => selectAll(event.currentTarget)}

        onChange={(event) => {
          let raw = event.target.value.replace(/[^\d.,]/g, "");
          // Typing over the resting "0" replaces it, wherever the caret sat.
          if (text === "0" && raw !== "0" && raw.includes("0")) {
            raw = raw.replace("0", "");
          }
          raw = raw.replace(/^0+(?=\d)/, "");
          setText(raw);
          if (commitOnly) return; // draft only — report on commit
          if (raw.trim() === "") return; // allow temporary blank, don't force 0
          onChange(clamp(parse(raw)));
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        onBlur={() => {
          setFocused(false);
          const next = text.trim() === "" ? clamp(min ?? 0) : clamp(parse(text));
          if (!commitOnly) onChange(next);
          onCommit?.(next);
          setText(toText(next, format, showZero));
        }}

        className={cn(
          "tnum w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground/40",
          inputClassName,
        )}
      />
      {suffix ? <span className="shrink-0 text-muted-foreground">{suffix}</span> : null}
    </div>
  );
}

function stripFormat(raw: string) {
  return raw.replace(/[^\d.,]/g, "");
}

function toText(value: number, format?: (value: number) => string, showZero = false) {
  if (value === 0) return showZero ? "0" : "";
  return format ? format(value) : String(value);
}
