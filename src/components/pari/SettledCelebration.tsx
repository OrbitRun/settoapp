import { useEffect } from "react";

import { MoneyAmount } from "@/components/pari/MoneyAmount";
import { PrimaryButton, SecondaryButton } from "@/components/pari/Buttons";
import { useT } from "@/lib/i18n";
import settoMark from "@/assets/setto-mark-dark.png.asset.json";

/**
 * Stage C1 — premium "all settled" state.
 *
 * Rendered only when a settlement the user just confirmed took the whole group
 * to zero according to the existing balance engine. Purely presentational: no
 * calculation, no persistence, no navigation of its own.
 */
const SPARKS = [
  { x: "-26px", y: "-34px", delay: "0.1s", left: "22%", top: "38%" },
  { x: "18px", y: "-40px", delay: "0.22s", left: "70%", top: "34%" },
  { x: "34px", y: "-22px", delay: "0.34s", left: "78%", top: "58%" },
  { x: "-32px", y: "-16px", delay: "0.16s", left: "18%", top: "60%" },
];

export function SettoMark() {
  return (
    <div className="relative h-32 w-[84px]">
      <div
        aria-hidden
        className="animate-setto-glow absolute -inset-6 rounded-full bg-accent/25 blur-3xl"
      />
      {SPARKS.map((spark) => (
        <span
          key={spark.left + spark.top}
          aria-hidden
          className="setto-spark animate-setto-spark absolute h-1 w-1 rounded-full bg-accent"
          style={
            {
              left: spark.left,
              top: spark.top,
              animationDelay: spark.delay,
              "--spark-x": spark.x,
              "--spark-y": spark.y,
            } as React.CSSProperties
          }
        />
      ))}
      <img
        src={settoMark.url}
        alt=""
        aria-hidden
        decoding="async"
        className="animate-setto-mark relative block h-32 w-full object-contain"
      />
    </div>
  );
}


export function SettledCelebration({
  contextName,
  settledMinor,
  onDone,
  onViewSummary,
}: {
  /** Group (or pair) name shown as context, e.g. "Zia & Jonas". */
  contextName?: string | undefined;
  /** The amount that was just settled — masked automatically by privacy mode. */
  settledMinor?: number | undefined;
  onDone: () => void;
  onViewSummary: () => void;
}) {
  const t = useT();

  // One subtle success haptic where the browser exposes one; no-op elsewhere.
  useEffect(() => {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    try {
      navigator.vibrate(12);
    } catch {
      /* haptics are best-effort */
    }
  }, []);

  // Paint the browser chrome / safe-area behind the overlay in the same deep
  // green so no light band shows above the celebration. Purely visual.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const DARK = "#071c19";
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const prevMeta = meta?.getAttribute("content") ?? null;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlBg = html.style.backgroundColor;
    const prevBodyBg = body.style.backgroundColor;
    meta?.setAttribute("content", DARK);
    html.classList.add("celebrating");
    html.style.backgroundColor = DARK;
    body.style.backgroundColor = DARK;
    // Native only: white status-bar content over the deep green surface.
    void syncNativeStatusBar(true, DARK);
    return () => {
      if (meta && prevMeta !== null) meta.setAttribute("content", prevMeta);
      html.classList.remove("celebrating");
      html.style.backgroundColor = prevHtmlBg;
      body.style.backgroundColor = prevBodyBg;
      void syncNativeStatusBar(html.classList.contains("dark"), undefined);
    };
  }, []);


  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("celebrate.title")}
      className="dark fixed inset-0 z-50 overflow-y-auto bg-[#071c19] text-foreground"
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-[-200px] h-[240px] bg-[#071c19]"
      />

      <div className="mx-auto flex min-h-svh w-full max-w-[430px] flex-col px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(2rem+env(safe-area-inset-top))]">
        <div className="flex flex-1 flex-col items-center justify-center gap-6 py-8 text-center">
          <SettoMark />

          <div className="animate-rise space-y-2" style={{ animationDelay: "0.9s" }}>
            <h1 className="text-[30px] font-semibold tracking-[-0.03em]">{t("celebrate.title")}</h1>
            <p className="text-[15px] text-muted-foreground">{t("celebrate.subtitle")}</p>
          </div>

          {contextName || typeof settledMinor === "number" ? (
            <div
              className="animate-rise w-full rounded-2xl bg-surface-strong px-5 py-4 text-left"
              style={{ animationDelay: "1.1s" }}
            >
              {contextName ? (
                <p className="truncate text-[15px] font-medium tracking-tight">{contextName}</p>
              ) : null}
              {typeof settledMinor === "number" ? (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[13px] text-muted-foreground">
                    {t("celebrate.settledAmount")}
                  </span>
                  <MoneyAmount minor={settledMinor} size="sm" />
                </div>
              ) : null}
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">
                  {t("celebrate.balanceNow")}
                </span>
                <MoneyAmount minor={0} size="sm" className="text-accent" />

              </div>
            </div>
          ) : null}
        </div>

        <div className="animate-rise space-y-3" style={{ animationDelay: "1.2s" }}>
          <PrimaryButton onClick={onDone}>{t("celebrate.done")}</PrimaryButton>
          <SecondaryButton onClick={onViewSummary}>{t("celebrate.viewSummary")}</SecondaryButton>
        </div>
      </div>
    </div>
  );
}
