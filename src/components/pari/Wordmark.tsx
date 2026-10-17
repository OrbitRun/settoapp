import { cn } from "@/lib/utils";

/**
 * Setto wordmark. Renders the approved SVG unmodified (aspect ratio preserved,
 * no background plate) and swaps between the light-surface and dark-surface
 * variants via the app's `.dark` class.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("block h-7", className)}>
      <img
        src="/brand/setto-wordmark-light.svg"
        alt="Setto"
        className="block h-full w-auto object-contain dark:hidden"
      />
      <img
        src="/brand/setto-wordmark-dark.svg"
        alt="Setto"
        aria-hidden
        className="hidden h-full w-auto object-contain dark:block"
      />
    </span>
  );
}
