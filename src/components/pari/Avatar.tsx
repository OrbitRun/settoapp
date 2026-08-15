import { cn } from "@/lib/utils";

const TONES = [
  "bg-[oklch(0.90_0.04_172)] text-[oklch(0.35_0.06_172)]",
  "bg-[oklch(0.92_0.03_95)] text-[oklch(0.42_0.05_80)]",
  "bg-[oklch(0.90_0.03_240)] text-[oklch(0.38_0.05_250)]",
  "bg-[oklch(0.92_0.035_40)] text-[oklch(0.45_0.07_40)]",
  "bg-[oklch(0.91_0.03_310)] text-[oklch(0.40_0.05_310)]",
  "bg-[oklch(0.89_0.04_150)] text-[oklch(0.36_0.06_150)]",
  "bg-[oklch(0.91_0.035_20)] text-[oklch(0.43_0.07_20)]",
  "bg-[oklch(0.90_0.03_270)] text-[oklch(0.38_0.05_275)]",
];

/** Hash the whole name (not just the first letter) so Mads/Mathias differ. */
function toneFor(name: string) {
  let hash = 0;
  for (const char of name.trim().toLowerCase()) {
    hash = (hash * 31 + char.charCodeAt(0)) % 100000;
  }
  return TONES[hash % TONES.length]!;
}

/**
 * Two characters whenever the name allows it — a single initial makes
 * Mads, Mathias and Mikkel look identical.
 */
export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    const only = parts[0]!;
    return (only.length > 1 ? only.slice(0, 2) : only.slice(0, 1)).toUpperCase();
  }
  return `${parts[0]!.slice(0, 1)}${parts[parts.length - 1]!.slice(0, 1)}`.toUpperCase();
}

/** First name only — used next to avatars where space is tight. */
export function firstNameOf(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

/**
 * Initials that stay unique inside one context (a group, a receipt).
 * Extends the label letter by letter until it no longer collides.
 */
export function disambiguateInitials(names: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of names) {
    let label = initialsOf(name);
    let length = 3;
    while (names.some((other) => other !== name && initialsOf(other) === label) && length <= 4) {
      label = name.trim().slice(0, length).toUpperCase();
      length += 1;
    }
    result[name] = label;
  }
  return result;
}

const SIZES = {
  xs: "h-6 w-6 text-[9px]",
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-xs",
  lg: "h-14 w-14 text-base",
};

export function Avatar({
  name,
  size = "md",
  className,
  selected = false,
  imageUrl,
  label,
}: {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
  selected?: boolean;
  /** Profile photo — always wins over initials when present. */
  imageUrl?: string | null;
  /** Overrides the initials (e.g. context-disambiguated label). */
  label?: string;
}) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        aria-hidden
        className={cn(
          "inline-block shrink-0 rounded-full object-cover",
          SIZES[size],
          selected && "ring-2 ring-primary ring-offset-1 ring-offset-surface",
          className,
        )}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight",
        SIZES[size],
        selected ? "bg-primary text-primary-foreground" : toneFor(name),
        className,
      )}
      aria-hidden
    >
      {label ?? initialsOf(name)}
    </span>
  );
}

export function AvatarStack({
  names,
  max = 4,
  size = "xs",
}: {
  names: string[];
  max?: number;
  size?: keyof typeof SIZES;
}) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;

  return (
    <span className="flex items-center">
      {shown.map((name, index) => (
        <Avatar
          key={`${name}-${index}`}
          name={name}
          size={size}
          className={cn("ring-2 ring-surface", index > 0 && "-ml-2")}
        />
      ))}
      {rest > 0 ? (
        <span className="-ml-2 inline-flex h-6 items-center rounded-full bg-surface-strong px-2 text-[10px] font-medium text-muted-foreground ring-2 ring-surface">
          +{rest}
        </span>
      ) : null}
    </span>
  );
}
