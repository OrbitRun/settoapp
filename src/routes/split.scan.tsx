import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, ImageUp, X } from "lucide-react";

import { Screen } from "@/components/pari/AppShell";
import { FlowHeader } from "@/components/pari/FlowHeader";
import { PrimaryButton, SecondaryButton } from "@/components/pari/Buttons";
import { parseReceipt } from "@/lib/receipt/parseReceipt";
import { usePari } from "@/data/store";

export const Route = createFileRoute("/split/scan")({
  head: () => ({
    meta: [
      { title: "Scan a receipt — PARI" },
      { name: "description", content: "Snap the receipt and PARI reads the items for you." },
      { property: "og:title", content: "Scan a receipt — PARI" },
      {
        property: "og:description",
        content: "Snap the receipt and PARI reads the items for you.",
      },
    ],
  }),
  component: ScanScreen,
});

function ScanScreen() {
  const pari = usePari();
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
      setError("That file isn't an image. Choose a photo of the receipt.");
      return;
    }
    setError(null);
    setFile(next);
  };

  const openCamera = () => {
    setError(null);
    if (!cameraRef.current) {
      setError("Camera isn't available here. Choose a photo instead.");
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
        title: parsed.merchant,
        amountMinor: parsed.totalMinor,
        items: parsed.items,
      }));
      navigate({ to: "/split/review" });
    } catch {
      setReading(false);
      setError("We couldn't read that receipt. Try another photo.");
    }
  };

  return (
    <Screen className="pb-16">
      <FlowHeader title="Scan receipt" variant="close" onClose={() => navigate({ to: "/" })} />

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={pick}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={pick}
      />

      <div className="flex min-h-[58svh] flex-col items-center justify-center px-2 text-center">
        {previewUrl ? (
          <div className="relative w-full max-w-[280px] overflow-hidden rounded-[26px] bg-surface shadow-soft">
            <img
              src={previewUrl}
              alt="Selected receipt"
              className="max-h-[46svh] w-full object-contain"
            />
            {!reading ? (
              <button
                type="button"
                onClick={() => setFile(null)}
                aria-label="Remove image"
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
          <div className="relative flex h-56 w-44 items-center justify-center overflow-hidden rounded-[26px] bg-surface shadow-soft">
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

        <p className="mt-8 text-[17px] font-medium tracking-tight">
          {reading
            ? "Reading receipt…"
            : previewUrl
              ? "Looks good?"
              : "Add a photo of the receipt"}
        </p>
        <p className="mt-2 max-w-[30ch] text-sm text-muted-foreground">
          {reading
            ? "Finding merchant, total and items."
            : previewUrl
              ? "Make sure the total and the lines are readable."
              : "Take a new photo or choose one from your library."}
        </p>

        {error ? (
          <p className="mt-3 max-w-[30ch] text-sm text-negative">{error}</p>
        ) : null}
      </div>

      {!reading ? (
        <div className="space-y-2">
          {previewUrl ? (
            <>
              <PrimaryButton onClick={read} disabled={!file}>
                Read receipt
              </PrimaryButton>
              <SecondaryButton onClick={openCamera}>
                <Camera className="h-4 w-4" strokeWidth={1.8} />
                Retake photo
              </SecondaryButton>
              <button
                type="button"
                onClick={() => libraryRef.current?.click()}
                className="mx-auto block pt-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Choose another photo
              </button>
            </>
          ) : (
            <>
              <PrimaryButton onClick={openCamera}>
                <Camera className="h-4 w-4" strokeWidth={1.8} />
                Take photo
              </PrimaryButton>
              <SecondaryButton onClick={() => libraryRef.current?.click()}>
                <ImageUp className="h-4 w-4" strokeWidth={1.8} />
                Choose photo
              </SecondaryButton>
            </>
          )}
        </div>
      ) : null}
    </Screen>
  );
}
