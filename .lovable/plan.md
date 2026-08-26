# Native Launch Readiness — N1 audit (read only)

Nothing was changed. Findings below are from reading the current project.

## 1. Delivery model

- **PWA only.** No Capacitor, no native wrapper, no `ios/` or `android/` folder, no `capacitor.config.*`. No Capacitor packages in `package.json`.
- **Bundle identifier:** none exists in the project. The only identifiers present are placeholders inside `public/.well-known/`: `TEAMID.app.pari.ios` and `app.pari.android` — both still carry the old PARI name and a fake team id.
- **App scheme / deep-link scheme:** none. All links are plain https web URLs.
- **Associated domains:** not configured (that lives in an iOS project, which does not exist).
- **`.well-known` files:** `apple-app-site-association` (paths `/invite/*`, placeholder app id) and `assetlinks.json` (placeholder SHA-256 fingerprint). Both are inert today.
- Manifest (`public/manifest.webmanifest`) is correct Setto branding, `display: standalone`, no service worker registered (no offline mode).

## 2. Authentication

- Providers in use: **email + password** (sign-up, sign-in, password reset) and **Google** via the managed Lovable Cloud OAuth helper (`lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`).
- **Apple Sign In does not exist anywhere.** The managed helper already accepts `"apple"` as a provider, but the provider is not enabled and no UI calls it.
- **Apple requirement:** yes. Because Google login is offered, App Review guideline 4.8 requires Sign in with Apple (or an equivalent privacy-preserving login) in the iOS build. This is a hard blocker for App Store submission.
- Redirect URLs today: `window.location.origin` for OAuth and email confirmation; `${origin}/reset-password` for recovery. All web-origin based, all fine for web, none valid inside a native container.
- Auth config carrying old PARI identifiers: none in Supabase; only the `.well-known` placeholders mentioned above.

## 3. Deep links

- **Invitations:** canonical `/invite/{token}` (with `/join/{token}` redirecting to it), built from `window.location.origin`. Already designed as the Universal Link target.
- **Auth callback:** back to the site origin after Google OAuth.
- **Password reset:** `/reset-password` on the site origin.
- **Receipt/share links:** none — sharing is clipboard text only.
- **App Store link** in `src/routes/invite.$token.tsx` is the placeholder `https://apps.apple.com/app/pari`.
- Must change for Setto/native: real app id + team id in `apple-app-site-association`, real release fingerprint in `assetlinks.json`, associated-domains entitlement for `settoapp.lovable.app`, real App Store URL, and auth redirects that resolve back into the app.

## 4. Session / token storage

- Sessions live in the browser via the generated Supabase client: `localStorage`, with a Lovable preview broker used only inside the editor iframe. `persistSession` and `autoRefreshToken` are on.
- For web this is standard and acceptable. Inside a Capacitor WebView, `localStorage` is app-sandboxed (not shared with other apps), so it is workable, but refresh tokens at rest are not encrypted and can be lost when the WebView storage is cleared.
- Recommended for native: a small custom Supabase `auth.storage` adapter backed by Keychain (e.g. `capacitor-secure-storage-plugin` or `@capacitor/preferences` + Keychain accessibility). The generated client file must not be edited — this needs a wrapper client or a Lovable-side change.
- The current web auth flow can be reused inside Capacitor, provided OAuth runs in an in-app browser / ASWebAuthenticationSession with a custom-scheme redirect rather than a plain in-WebView redirect.

## 5. Icons / splash / status bar

- PWA icons present: `favicon.png`, `apple-touch-icon.png`, `brand/icon-192.png`, `brand/icon-512.png`, `brand/icon-512-dark.png`; manifest wired correctly.
- Missing for native: iOS `AppIcon` asset catalog (all sizes from the approved 1024×1024 light/dark/tinted art), launch screen / splash assets, `@capacitor/splash-screen` config.
- Light/dark/tinted source art exists in the earlier brand upload but is not committed as an iOS asset set.
- Status bar: web-side only (`theme-color`, `viewport-fit=cover`, safe-area padding, the celebration screen overrides `theme-color`). Native needs `@capacitor/status-bar` style handling to mirror that.

## 6. Native privacy / haptics

- App-switcher masking: not possible on web; needs a native privacy-overlay on `appStateChange`.
- Screenshot/recording protection: not available on web; on iOS only detection is possible (no true block).
- Face ID / biometrics: absent. Would pair naturally with the existing Privacy Mode as an app lock.
- Haptics: only `navigator.vibrate` (no-op on iOS) in the celebration. Would move to `@capacitor/haptics`.
- Clipboard: `navigator.clipboard` in share/settle/invite flows — works in WebView, but `@capacitor/clipboard` is more reliable.

## 7. Push notifications

- No push infrastructure at all: no APNs, no Firebase, no Capacitor Push, no device-token table, no notification triggers.
- Later this needs an Apple push key, a device-token table with RLS, a send path, and permission UX.
- Best first notifications, in order: **invitations** (someone invited you / joined), **settlement reminders** (you owe / you were paid), then **group activity** (new expense).

## 8. App Store readiness gaps

- Privacy policy URL: **missing** (no page, no link).
- Terms URL: **missing**.
- Support URL / contact: **missing**.
- Account deletion: **implemented and compliant** — in-app, reachable from Profile with typed confirmation, deletes data and the auth user server-side, and cleans up private receipt images. It satisfies guideline 5.1.1(v). It still needs a publicly documented deletion path in the privacy policy.
- Sign in with Apple: **missing, required** (see §2).
- Privacy labels: not prepared. Data collected: email, name, expense/receipt data, receipt images; receipts are sent to an AI vision service — this must be declared.
- Tracking declarations: no tracking SDKs present, so "not used for tracking" — easy.
- Screenshots, subtitle, description, age rating (4+ likely), export compliance (standard HTTPS only → exempt declaration), TestFlight: all still to do.

## 9. Delivery options

| | A. Stay PWA | B. Capacitor | C. Full native shell |
|---|---|---|---|
| Effort | none | small–medium | very large |
| Risk | low | low–medium | high |
| App Store | not listable | fully suitable | fully suitable |
| Codebase reuse | 100% | ~100% | ~0% UI |
| Auth / deep links | works today | needs Apple Sign In + custom scheme + universal links | full rewrite |
| Camera / receipts | works, limited | native camera, better quality | best |
| Privacy / haptics / icons | none | full access | full access |

**Recommendation: B — Capacitor.** It keeps the entire existing app, unlocks App Store distribution, native privacy masking, haptics, real icons and camera, with the smallest safe change surface.

## 10. Apple Sign In plan (design only)

- **Apple Developer:** App ID with Sign in with Apple capability; Services ID for the web/OAuth leg; a `.p8` key + Key ID + Team ID; the backend callback URL registered on the Services ID.
- **Backend:** enable the Apple provider through Lovable Cloud's managed social login in the same change that ships the button (otherwise sign-in fails with "provider not supported"). Managed credentials are enough unless custom branding is wanted.
- **Redirect:** `redirect_uri` must be a full same-origin public URL (`window.location.origin`); native uses an in-app auth session that hands the tokens back to the app.
- **Native:** add the Sign in with Apple entitlement and the associated-domains entitlement in Xcode.
- **Frontend:** one Apple button on `/auth` next to Google, calling the existing managed helper with `"apple"`; Apple's exact button styling rules apply.
- **Account linking:** Apple's private relay emails mean the same human can arrive as a second account. Decide up front whether to match on email and merge, or keep accounts separate (the existing person model makes separate safer).
- **Testing:** first-time consent (name is only returned once), private-relay email path, repeat sign-in, cancel path, and pending-invite continuation after Apple login.

## 11. Roadmap after this audit

- **N2 — Capacitor foundation:** add Capacitor, iOS project, bundle id `app.setto.ios` (final id to confirm), app icons, splash, status bar, safe areas verified on device.
- **N3 — Auth + deep links:** Sign in with Apple end to end, native-safe OAuth redirect, Keychain-backed session storage, universal links for `/invite/*` and password reset, real `.well-known` values, real App Store URL.
- **N4 — Native polish:** app-switcher privacy mask (tied to Privacy Mode), optional Face ID lock, native haptics, native camera for receipts, native clipboard/share.
- **N5 — Store package:** privacy policy / terms / support pages, privacy labels, screenshots, subtitle and description, age rating, export compliance, TestFlight build, submission.
- Push notifications stay out of the first release; slot them as N6.

## 12. Remaining launch blockers

1. No native project at all (no Capacitor, no bundle id).
2. Sign in with Apple missing while Google is offered.
3. Privacy policy, terms and support URLs missing.
4. `.well-known` files carry PARI placeholders and a fake team id/fingerprint.
5. Placeholder App Store URL on the invite page.
6. No iOS icon set, launch screen, or status-bar handling.
7. Session tokens not in Keychain.
8. Store metadata, screenshots and privacy labels not prepared.
