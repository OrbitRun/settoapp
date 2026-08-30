# Fix duplicate PKCE consumer for native /auth/callback

## Root cause

Two `App.addListener("appUrlOpen")` listeners race on the same one-time PKCE code:

- `src/lib/native-auth.ts` → `nativeOAuthSignIn()` exchanges the code and resolves the result.
- `src/lib/deep-links.ts` → `useDeepLinks()` calls `consumeAuthParams()` which also calls `supabase.auth.exchangeCodeForSession(code)` for `/auth/callback`.

Whichever listener loses the race exchanges an already-consumed code and can surface a provider failure/cancellation. The stray "No active window to close!" log follows from the losing path's cleanup.

## Fix: single owner

**`src/lib/native-auth.ts` remains the sole owner of `/auth/callback` code exchange on native.**

### `src/lib/deep-links.ts`
- In `consumeAuthParams`, only consume auth params for `/reset-password`. Remove the code exchange for `/auth/callback`.
- Keep `/auth/callback` in `ALLOWED_PREFIXES` (still a recognized Universal Link) and keep the navigation to `/home` after the auth-session listener establishes the session.
- Add diagnostic log: `[NATIVE_DEEPLINK] auth callback observed — not consuming code`.
- Invite/join links, cold-start routing, and reset-password handling unchanged.

### `src/lib/native-auth.ts`
- No ownership change (already exchanges code and resolves `NativeAuthResult`).
- Add temporary diagnostic markers (never log URL query, code, tokens, or session):
  - `[NATIVE_OAUTH] provider start`
  - `[NATIVE_OAUTH] auth URL created`
  - `[NATIVE_OAUTH] browser opened`
  - `[NATIVE_OAUTH] appUrlOpen callback received`
  - `[NATIVE_OAUTH] code found`
  - `[NATIVE_OAUTH] exchange starting`
  - `[NATIVE_OAUTH] exchange success`
  - `[NATIVE_OAUTH] finish success`
  - `[NATIVE_OAUTH] browserFinished`
  - `[NATIVE_OAUTH] finish cancelled`
  - `[NATIVE_OAUTH] exchange error <message>`

## Untouched
- Provider configuration, bundle ID, AASA, capabilities
- Web OAuth behaviour (`lovable.auth.signInWithOAuth` in `auth.index.tsx`)
- Keychain session persistence
- Pending invitation continuation, reset-password flow, UI styling, database/RLS

## Validation
- `tsc --noEmit` typecheck
- `bun run build` (web)
- `SETTO_NATIVE=1 vite build` (native)
- `bunx cap sync ios`
- Confirm `exchangeCodeForSession` for `/auth/callback` appears in exactly one place (`native-auth.ts`).
