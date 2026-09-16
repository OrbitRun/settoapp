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

/** Setto surface colours — must mirror the CSS background tokens. */
export const SETTO_SURFACE_LIGHT = "#F7F6F2";
export const SETTO_SURFACE_DARK = "#071C19";

/** The native surface colour for the currently rendered appearance. */
export function settoSurfaceColor(dark: boolean): string {
  return dark ? SETTO_SURFACE_DARK : SETTO_SURFACE_LIGHT;
}

/**
 * Push the active Setto background down to the native layer (WKWebView, its
 * scroll view and the hosting view), so an iOS rubber-band overscroll never
 * exposes the default white WebView surface. No-op on web.
 */
export function syncNativeSurface(color: string) {
  if (!isNative()) return;
  try {
    (
      window as unknown as {
        webkit?: { messageHandlers?: Record<string, { postMessage: (value: string) => void }> };
      }
    ).webkit?.messageHandlers?.["settoSurface"]?.postMessage(color);
  } catch {
    /* handler unavailable — ignore */
  }
}

/**
 * Match the native status bar to the surface currently rendered underneath it.
 * `dark` here means "dark surface" → light (white) status-bar content.
 */
export async function syncNativeStatusBar(dark: boolean, backgroundColor?: string) {
  if (!isNative()) return;
  syncNativeSurface(backgroundColor ?? settoSurfaceColor(dark));
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
