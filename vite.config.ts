// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

/**
 * Native (Capacitor/iOS) build mode.
 *
 * `SETTO_NATIVE=1 vite build` emits a prerendered SPA shell at
 * `dist/client/index.html` so the iOS app can boot entirely from its bundled
 * assets — no remote `server.url`. Server functions are still called against
 * the deployed Setto origin at runtime (see `src/lib/native-serverfn.ts`).
 *
 * Without the flag the normal SSR web build is produced, unchanged.
 */
const isNativeBuild = process.env["SETTO_NATIVE"] === "1";

export default defineConfig({
  // Native builds only need the client bundle; skip the Cloudflare worker output.
  ...(isNativeBuild ? { nitro: false as const } : {}),
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    ...(isNativeBuild
      ? {
          spa: {
            enabled: true,
            prerender: {
              enabled: true,
              outputPath: "/index.html",
            },
          },
        }
      : {}),
  },
});
