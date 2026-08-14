import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Renders a value as a QR image — generated in the browser, no network. */
export function QrCode({ value, size = 200 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      color: { dark: "#062D24", light: "#FFFFFF" },
    })
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => setSrc(null));
    return () => {
      active = false;
    };
  }, [value, size]);

  return (
    <div
      className="mx-auto flex items-center justify-center rounded-3xl bg-white p-3 shadow-soft"
      style={{ width: size + 24, height: size + 24 }}
    >
      {src ? (
        <img src={src} alt="" aria-hidden width={size} height={size} className="rounded-xl" />
      ) : (
        <div className="h-full w-full animate-pulse rounded-xl bg-surface-strong" />
      )}
    </div>
  );
}
