/**
 * Privacy mode ("hide amounts"). Device-local, visual only.
 * Money formatting reads this flag; no numeric value or query data changes.
 */
import { useSyncExternalStore } from "react";

export const HIDE_AMOUNTS_KEY = "setto.hideAmounts";

/** Fixed-length mask so bullet count never leaks magnitude. */
export const AMOUNT_MASK = "••••••";

let hidden = readInitial();
const listeners = new Set<() => void>();

function readInitial(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(HIDE_AMOUNTS_KEY) === "true";
  } catch {
    return false;
  }
}

export function getHideAmounts(): boolean {
  return hidden;
}

export function setHideAmounts(value: boolean) {
  if (hidden === value) return;
  hidden = value;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(HIDE_AMOUNTS_KEY, value ? "true" : "false");
    } catch {
      // Storage unavailable (private mode) — keep the in-memory preference.
    }
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Re-renders the component whenever privacy mode changes. */
export function useHideAmounts(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => hidden,
    () => false,
  );
}
