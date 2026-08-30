/**
 * Custom client entry (wired via `tanstackStart.client.entry` in vite.config.ts).
 *
 * Identical to TanStack Start's default entry, except that on native
 * (Capacitor) builds the Keychain-backed Supabase session is restored into
 * synchronous storage BEFORE React hydrates. Previously the root component
 * gated rendering on that async step, which made the first client render
 * (a blank placeholder) differ from the prerendered SPA shell — React minified
 * error #418 (hydration mismatch) and a permanently blank native screen.
 *
 * On the web `initNativeSecureSession()` resolves immediately as a no-op, so
 * SSR hydration is unchanged.
 *
 * TEMPORARY DIAGNOSTICS: `[NATIVE_BOOT …]` markers trace the native boot path.
 * They never log token, key or session values — stage names and counts only.
 * Remove once the native blank-screen root cause is proven.
 */
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";

import { initNativeSecureSession } from "./lib/native-secure-session";

const BOOT_T0 = Date.now();
const bootLog = (marker: string, extra?: string) => {
  // eslint-disable-next-line no-console
  console.log(`${marker} +${Date.now() - BOOT_T0}ms${extra ? ` ${extra}` : ""}`);
};

if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    const err = event.error as Error | undefined;
    bootLog(
      "[NATIVE_BOOT ERROR]",
      `name=${err?.name ?? "unknown"} message=${err?.message ?? event.message} src=${event.filename ?? "?"}:${event.lineno ?? "?"}:${event.colno ?? "?"} stack=${err?.stack ?? "none"}`,
    );
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as Error | undefined;
    bootLog(
      "[NATIVE_BOOT REJECTION]",
      `name=${reason?.name ?? "unknown"} message=${reason?.message ?? String(event.reason)} stack=${reason?.stack ?? "none"}`,
    );
  });
}

bootLog("[NATIVE_BOOT 1] client-entry module loaded");

bootLog("[NATIVE_BOOT 2] secure-session init starting");
void initNativeSecureSession().then(() => {
  bootLog("[NATIVE_BOOT 3] secure-session init resolved");
  startTransition(() => {
    bootLog("[NATIVE_BOOT 4] hydrateRoot starting");
    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>,
    );
    bootLog("[NATIVE_BOOT 5] hydrateRoot returned");
  });
});
