import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, ImageUp } from "lucide-react";

import { Screen } from "@/components/pari/AppShell";
import { FlowHeader } from "@/components/pari/FlowHeader";
import { PrimaryButton, SecondaryButton } from "@/components/pari/Buttons";
import { MOCK_RECEIPT, mockReceiptItems } from "@/data/mockReceipt";
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
  const [scanning, setScanning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => (timer.current ? clearTimeout(timer.current) : undefined), []);

  const start = () => {
    setScanning(true);
    timer.current = setTimeout(() => {
      pari.setDraft((prev) => ({
        ...prev,
        source: "receipt",
        merchant: MOCK_RECEIPT.merchant,
        title: MOCK_RECEIPT.merchant,
        amountMinor: MOCK_RECEIPT.totalMinor,
        items: mockReceiptItems(),
      }));
      navigate({ to: "/split/review" });
    }, 2100);
  };

  return (
    <Screen className="pb-16">
      <FlowHeader title="Scan receipt" variant="close" onClose={() => navigate({ to: "/" })} />

      <div className="flex min-h-[62svh] flex-col items-center justify-center px-2 text-center">
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
          {scanning ? (
            <div className="absolute inset-x-0 top-0 h-1/3 animate-[pari-rise_1.4s_ease-in-out_infinite_alternate] bg-gradient-to-b from-accent/35 to-transparent" />
          ) : null}
        </div>

        <p className="mt-8 text-[17px] font-medium tracking-tight">
          {scanning ? "Scanning receipt…" : "Point at the whole receipt"}
        </p>
        <p className="mt-2 max-w-[28ch] text-sm text-muted-foreground">
          {scanning
            ? "Reading merchant, total and items."
            : "Keep it flat and make sure the total is visible."}
        </p>
      </div>

      {!scanning ? (
        <div className="space-y-2">
          <PrimaryButton onClick={start}>
            <Camera className="h-4 w-4" strokeWidth={1.8} />
            Take photo
          </PrimaryButton>
          <SecondaryButton onClick={() => fileRef.current?.click()}>
            <ImageUp className="h-4 w-4" strokeWidth={1.8} />
            Upload image
          </SecondaryButton>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={start}
          />
        </div>
      ) : null}
    </Screen>
  );
}
