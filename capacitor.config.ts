import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Setto — native shell configuration (N2 foundation).
 *
 * The web app is a TanStack Start app with server-side rendering and server
 * functions, so the native shell loads the deployed Setto origin instead of a
 * purely static local bundle (a local bundle would have no SSR HTML and no
 * server-function endpoint). `webDir` still points at the built client assets
 * so `cap sync` has a valid, non-secret asset payload to copy.
 */
const config: CapacitorConfig = {
  appId: "dk.setto.app",
  appName: "Setto",
  webDir: "dist/client",
  ios: {
    contentInset: "never",
    limitsNavigationsToAppBoundDomains: false,
    backgroundColor: "#F7F6F2",
  },
  server: {
    // Production Setto deployment. Replaced by a local bundle only if the app
    // is ever migrated to a fully client-rendered build.
    url: "https://settoapp.lovable.app",
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
