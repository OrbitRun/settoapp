/**
 * Keychain-backed Supabase session persistence — native (Capacitor) only.
 *
 * Why a mirror instead of a Supabase `storage` adapter: the generated
 * `src/integrations/supabase/client.ts` is auto-generated and must not be
 * edited, and its storage slot is already owned by the Lovable preview
 * brokered storage. Instead we keep the existing synchronous storage as the
 * live read path and mirror every Supabase auth key (`sb-*`) into the iOS
 * Keychain:
 *
 *  - on cold start we hydrate the Keychain copy back into localStorage BEFORE
 *    the app reads any session (the root gates rendering on this),
 *  - every later write/removal is mirrored to the Keychain,
 *  - sign-out / account deletion wipes the Keychain copy.
 *
 * On the web every function here is an immediate no-op, so PWA behaviour is
 * byte-for-byte unchanged.
 *
 * Package: `@aparajita/capacitor-secure-storage` — actively maintained,
 * Capacitor 8 compatible, iOS Keychain (kSecClassGenericPassword) backed, no
 * native patching required.
 */
import { isNative } from "./native";

const AUTH_KEY_PREFIX = "sb-";

let hydration: Promise<void> | null = null;
let patched = false;

const isAuthKey = (key: string) => key.startsWith(AUTH_KEY_PREFIX);

async function secureStorage() {
  const { SecureStorage } = await import("@aparajita/capacitor-secure-storage");
  return SecureStorage;
}

type SecureStorageApi = Awaited<ReturnType<typeof secureStorage>>;

function patchStorage(store: SecureStorageApi) {
  if (patched || typeof Storage === "undefined") return;
  patched = true;

  const proto = Storage.prototype;
  const originalSet = proto.setItem;
  const originalRemove = proto.removeItem;
  const originalClear = proto.clear;

  proto.setItem = function setItem(key: string, value: string) {
    originalSet.call(this, key, value);
    if (this === window.localStorage && isAuthKey(key)) {
      void store.setItem(key, value).catch(() => undefined);
    }
  };

  proto.removeItem = function removeItem(key: string) {
    originalRemove.call(this, key);
    if (this === window.localStorage && isAuthKey(key)) {
      void store.remove(key).catch(() => undefined);
    }
  };

  proto.clear = function clear() {
    const wasLocal = this === window.localStorage;
    originalClear.call(this);
    if (wasLocal) void clearNativeSecureSession();
  };

  return { originalSet };
}

/**
 * Restores the Keychain session copy into the synchronous storage the Supabase
 * client reads, then installs the write mirror. Idempotent; resolves instantly
 * on web.
 */
export function initNativeSecureSession(): Promise<void> {
  if (hydration) return hydration;
  if (!isNative() || typeof window === "undefined") {
    hydration = Promise.resolve();
    return hydration;
  }

  // TEMPORARY DIAGNOSTICS: stage markers + counts only, never key/session values.
  let pending = true;
  const watchdog = setTimeout(() => {
    if (pending) console.log("[NATIVE_BOOT WATCHDOG] secure session init still pending");
  }, 3000);

  hydration = (async () => {
    try {
      console.log("[NATIVE_BOOT KEYCHAIN 1] plugin import starting");
      const store = await secureStorage();
      console.log("[NATIVE_BOOT KEYCHAIN 2] plugin import resolved");
      const rawSet = Storage.prototype.setItem;
      console.log("[NATIVE_BOOT KEYCHAIN 3] keys() starting");
      const keys = await store.keys();
      console.log(`[NATIVE_BOOT KEYCHAIN 4] keys() resolved — count=${keys.length}`);
      console.log("[NATIVE_BOOT KEYCHAIN 5] getItem starting");
      for (const key of keys) {
        if (!isAuthKey(key)) continue;
        const value = await store.getItem(key);
        // Only seed what is missing — a live in-memory session always wins.
        if (typeof value === "string" && window.localStorage.getItem(key) === null) {
          rawSet.call(window.localStorage, key, value);
        }
      }
      patchStorage(store);
      console.log("[NATIVE_BOOT KEYCHAIN 6] hydration completed");
    } catch (error) {
      /* Keychain unavailable — fall back to the default storage silently. */
      console.log(
        `[NATIVE_BOOT KEYCHAIN ERROR] name=${(error as Error)?.name ?? "unknown"} message=${(error as Error)?.message ?? String(error)}`,
      );
    } finally {
      pending = false;
      clearTimeout(watchdog);
    }
  })();

  return hydration;
}


/** Removes every persisted Supabase auth key from the Keychain. */
export async function clearNativeSecureSession(): Promise<void> {
  if (!isNative()) return;
  try {
    const store = await secureStorage();
    const keys = await store.keys();
    await Promise.all(keys.filter(isAuthKey).map((key) => store.remove(key).catch(() => false)));
  } catch {
    /* nothing persisted / plugin unavailable */
  }
}
