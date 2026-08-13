import { cn } from "@/lib/utils";

const TONES = [
  "bg-[oklch(0.90_0.04_172)] text-[oklch(0.35_0.06_172)]",
  "bg-[oklch(0.92_0.03_95)] text-[oklch(0.42_0.05_80)]",
  "bg-[oklch(0.90_0.03_240)] text-[oklch(0.38_0.05_250)]",
  "bg-[oklch(0.92_0.035_40)] text-[oklch(0.45_0.07_40)]",
  "bg-[oklch(0.91_0.03_310)] text-[oklch(0.40_0.05_310)]",
];

function toneFor(name: string) {
  const sum = [...name].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return TONES[sum % TONES.length]!;
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[parts.length - 1]!.slice(0, 1)}`.toUpperCase();
}

const SIZES = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
};

export function Avatar({
  name,
  size = "md",
  className,
  selected = false,
}: {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
  selected?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-medium tracking-tight",
        SIZES[size],
        selected ? "bg-primary text-primary-foreground" : toneFor(name),
        className,
      )}
      aria-hidden
    >
      {initialsOf(name)}
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
