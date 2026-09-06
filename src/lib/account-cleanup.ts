/**
 * Local device wipe after a confirmed account deletion.
 *
 * Setto owns three key families in web storage: the Supabase session (`sb-`),
 * the legacy app namespace (`pari.`) and the current one (`setto.`). Anything
 * else on the device belongs to other sites and is never touched.
 */

const SETTO_PREFIXES = ["sb-", "pari.", "setto."];

const isSettoKey = (key: string) => SETTO_PREFIXES.some((prefix) => key.startsWith(prefix));

/** Every Setto-owned key currently present in the given storage. */
export function settoLocalKeys(storage: Storage): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && isSettoKey(key)) keys.push(key);
  }
  return keys;
}

/** Removes all Setto-owned keys, leaving unrelated browser data alone. */
export function clearSettoLocalState(storage: Storage) {
  for (const key of settoLocalKeys(storage)) {
    try {
      storage.removeItem(key);
    } catch {
      /* storage unavailable */
    }
  }
}

/** Browser entry point: clears both local and session storage. */
export function clearSettoDeviceState() {
  if (typeof window === "undefined") return;
  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      if (storage) clearSettoLocalState(storage);
    } catch {
      /* storage unavailable */
    }
  }
}
