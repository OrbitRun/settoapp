/**
 * Thin native (Capacitor) helpers. Every function is a no-op on the web build,
 * so the PWA behaves exactly as before.
 */
import { Capacitor } from "@capacitor/core";

export const isNative = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

/**
 * Match the native status bar to the surface currently rendered underneath it.
 * `dark` here means "dark surface" → light (white) status-bar content.
 */
export async function syncNativeStatusBar(dark: boolean, backgroundColor?: string) {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    // Android-only; harmless no-op on iOS where the WebView paints the area.
    if (backgroundColor && Capacitor.getPlatform() === "android") {
      await StatusBar.setBackgroundColor({ color: backgroundColor });
    }
    await StatusBar.setOverlaysWebView({ overlay: true });
  } catch {
    /* plugin unavailable — ignore */
  }
}

/** Dismiss the native launch screen once the web app has rendered. */
export async function hideNativeSplash() {
  if (!isNative()) return;
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {
    /* plugin unavailable — ignore */
  }
}
