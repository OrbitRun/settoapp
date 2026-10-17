import { cn } from "@/lib/utils";
import wordmark from "@/assets/payside-wordmark.png.asset.json";
import lightWordmark from "@/assets/payside-wordmark-light.png.asset.json";

/**
 * Payside wordmark. Renders the approved PNG unmodified (aspect ratio preserved,
 * no background plate) and swaps between the light-surface and dark-surface
 * variants via the app's `.dark` class.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("block h-7", className)}>
      <img
        src={wordmark.url}
        alt="Payside"
        className="block h-full w-auto object-contain dark:hidden"
      />
      <img
        src={lightWordmark.url}
        alt="Payside"
        aria-hidden
        className="hidden h-full w-auto object-contain dark:block"
      />
    </span>
  );
}
