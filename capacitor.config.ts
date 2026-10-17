import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Setto — native shell configuration.
 *
 * The iOS app boots from its bundled local web assets (`dist/client`, built with
 * `SETTO_NATIVE=1 vite build`, which emits a real `index.html` SPA shell).
 * There is no production `server.url`: the app is not a remote website wrapper.
 * Server functions are called against the deployed Setto origin at runtime via
 * the native server-function fetch adapter (`src/lib/native-serverfn.ts`).
 */
const config: CapacitorConfig = {
  appId: "dk.setto.app",
  appName: "Setto",
  webDir: "dist/client",
  ios: {
    contentInset: "never",
    limitsNavigationsToAppBoundDomains: false,
    backgroundColor: "#F7F6F2",
    scheme: "capacitor",
  },
  server: {
    iosScheme: "capacitor",
    androidScheme: "https",
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 600,
      backgroundColor: "#071C19",
      iosSplashResourceName: "Splash",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false,
    },
  },
};

export default config;
