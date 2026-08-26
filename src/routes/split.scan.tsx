import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, ImageUp, RotateCw, Shield, X } from "lucide-react";

import { Screen } from "@/components/pari/AppShell";
import { FlowHeader } from "@/components/pari/FlowHeader";
import { PrimaryButton, SecondaryButton } from "@/components/pari/Buttons";
import { parseReceipt, receiptErrorCode } from "@/lib/receipt/parseReceipt";
import { usePari } from "@/data/store";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/split/scan")({
  head: () => ({
    meta: [
      { title: "Scan a receipt — Setto" },
      { name: "description", content: "Snap the receipt and Setto reads the items for you." },
      { property: "og:title", content: "Scan a receipt — Setto" },
      {
        property: "og:description",
        content: "Snap the receipt and Setto reads the items for you.",
      },
    ],
  }),
  component: ScanScreen,
});

function ScanScreen() {
  const pari = usePari();
  const t = useT();
  const navigate = useNavigate();
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!next) return;
    if (!next.type.startsWith("image/")) {
      setError(t("scan.notImage"));
      return;
    }
    setError(null);
    setFile(next);
  };

  const openCamera = () => {
    setError(null);
    if (!cameraRef.current) {
      setError(t("scan.noCamera"));
      return;
    }
    cameraRef.current.click();
  };

  const read = async () => {
    if (!file) return;
    setReading(true);
    setError(null);
    try {
      const parsed = await parseReceipt(file);
      pari.setDraft((prev) => ({
        ...prev,
        source: "receipt",
        merchant: parsed.merchant,
        merchantRaw: parsed.merchantRaw,
        merchantAddress: parsed.merchantAddress,
        title: parsed.merchant,
        amountMinor: parsed.totalMinor,
        items: parsed.items,
        receiptWarnings: parsed.warnings,
        receiptDiscountMinor: parsed.receiptDiscountMinor,
        dateIso: parsed.dateIso,
        // The receipt's own currency wins; the user can still change it in review.
        currency: parsed.currency || pari.currency,
        currencyConfidence: parsed.currencyConfidence,
        currencyEvidence: parsed.currencyEvidence,
        currencyConfirmed: false,
        totalConfidence: parsed.totalConfidence,
      }));

      navigate({ to: "/split/review" });
    } catch (caught) {
      setReading(false);
      const code = receiptErrorCode(caught);
      const key =
        code === "AI_TIMEOUT"
          ? "scan.errorTimeout"
          : code === "AI_RATE_LIMITED"
            ? "scan.errorBusy"
            : code === "AI_CREDITS_EXHAUSTED"
              ? "scan.errorCredits"
              : code === "IMAGE_TOO_LARGE"
                ? "scan.errorTooLarge"
                : code === "NO_RECEIPT_DETECTED"
                  ? "scan.errorNoReceipt"
                  : "scan.failed";
      setError(t(key));
    }
  };

  return (
    <Screen className="pb-16">
      <FlowHeader
        title={t("split.scan")}
        variant="close"
        onClose={() => navigate({ to: pari.isGuest ? "/" : "/home" })}
      />

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={pick}
      />
      <input ref={libraryRef} type="file" accept="image/*" className="hidden" onChange={pick} />

      <div className="flex min-h-[46svh] flex-col items-center justify-center px-2 text-center">
        {previewUrl ? (
          <div className="relative w-full max-w-[280px] overflow-hidden rounded-[26px] bg-surface shadow-soft">
            <img
              src={previewUrl}
              alt={t("scan.selectedAlt")}
              className="max-h-[40svh] w-full object-contain"
            />
            {!reading ? (
              <button
                type="button"
                onClick={() => setFile(null)}
                aria-label={t("scan.removeImage")}
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-background/85 backdrop-blur"
              >
                <X className="h-4 w-4" strokeWidth={1.8} />
              </button>
            ) : null}
            {reading ? (
              <div className="absolute inset-x-0 top-0 h-1/3 animate-[pari-rise_1.4s_ease-in-out_infinite_alternate] bg-gradient-to-b from-accent/35 to-transparent" />
            ) : null}
          </div>
        ) : (
          <div className="relative flex h-52 w-44 items-center justify-center overflow-hidden rounded-[26px] bg-surface shadow-soft">
            <div className="absolute inset-x-6 top-8 space-y-2.5">
              {[100, 78, 92, 64, 84, 56].map((width, index) => (
                <div
                  key={index}
                  className="h-2 rounded-full bg-surface-strong"
                  style={{ width: `${width}%` }}
                />
              ))}
            </div>
          </div>
        )}

        <p className="mt-6 text-[17px] font-medium tracking-tight">
          {reading ? t("scan.reading") : previewUrl ? t("scan.looksGood") : t("scan.addPhoto")}
        </p>
        <p className="mt-1 max-w-[30ch] text-sm text-muted-foreground">
          {reading
            ? t("scan.readingHint")
            : previewUrl
              ? t("scan.looksGoodHint")
              : t("scan.addPhotoHint")}
        </p>

        {error ? <p className="mt-2 max-w-[30ch] text-sm text-negative">{error}</p> : null}
      </div>

      {!reading ? (
        <div className="space-y-5">
          {previewUrl ? (
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5" strokeWidth={1.6} />
              {t("scan.disclosure")}
            </p>
          ) : null}
          <div className="space-y-2">
          {previewUrl ? (
            <>
              <PrimaryButton onClick={read} disabled={!file}>
                {error ? (
                  <>
                    <RotateCw className="h-4 w-4" strokeWidth={1.8} />
                    {t("scan.tryAgain")}
                  </>
                ) : (
                  t("scan.read")
                )}
              </PrimaryButton>
              <SecondaryButton onClick={openCamera}>
                <Camera className="h-4 w-4" strokeWidth={1.8} />
                {t("scan.retake")}
              </SecondaryButton>
              <button
                type="button"
                onClick={() => libraryRef.current?.click()}
                className="mx-auto block pt-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("scan.another")}
              </button>
              {error ? (
                <button
                  type="button"
                  onClick={() => navigate({ to: "/split/amount" })}
                  className="mx-auto block pt-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t("scan.enterManually")}
                </button>
              ) : null}
            </>
          ) : (
            <>
              <PrimaryButton onClick={openCamera}>
                <Camera className="h-4 w-4" strokeWidth={1.8} />
                {t("scan.take")}
              </PrimaryButton>
              <SecondaryButton onClick={() => libraryRef.current?.click()}>
                <ImageUp className="h-4 w-4" strokeWidth={1.8} />
                {t("scan.choose")}
              </SecondaryButton>
            </>
          )}
        </div>
      </div>
    ) : null}
    </Screen>
  );
}
