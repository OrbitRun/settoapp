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
 */
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";

import { initNativeSecureSession } from "./lib/native-secure-session";

void initNativeSecureSession().then(() => {
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>,
    );
  });
});
