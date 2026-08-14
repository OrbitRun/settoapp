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
}) {

  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => toText(value, format));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (focused) return;
    setText(toText(value, format));
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
          const el = event.target;
          requestAnimationFrame(() => {
            try {
              el.select();
            } catch {
              el.setSelectionRange(el.value.length, el.value.length);
            }
          });
        }}
        onChange={(event) => {
          const raw = event.target.value.replace(/[^\d.,]/g, "");
          setText(raw);
          if (raw.trim() === "") return; // allow temporary blank, don't force 0
          onChange(clamp(parse(raw)));
        }}
        onBlur={() => {
          setFocused(false);
          const next = text.trim() === "" ? clamp(min ?? 0) : clamp(parse(text));
          onChange(next);
          onCommit?.(next);
          setText(toText(next, format));
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

function toText(value: number, format?: (value: number) => string) {
  if (value === 0) return "";
  return format ? format(value) : String(value);
}
