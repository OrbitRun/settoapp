# Auth polish + native iOS feel (pre-release)

## What I found first

**Sign-in copy** — English already says "Continue with Google" but Apple says "Sign in with Apple"; Danish says "Fortsæt med Google" / "Log ind med Apple". Both provider buttons are already shown in both modes and already sign in or create an account, so only the Apple wording changes.

**Why sign-in stays in the browser (root cause)** — the whole OAuth journey runs on `setto.dk`: the flow opens `https://setto.dk/~oauth/initiate` in the system browser, and the provider finally returns to `https://setto.dk/auth/callback`. iOS deliberately does **not** hand a link to the app when the browser is already on that same domain — it just loads the page. So the callback renders as an ordinary Setto web page in Safari, the app never hears about it, and the sign-in sheet stays open until it times out as "cancelled".

The dedicated hand-off address `open.setto.dk` is already live, already claimed by the app, and its app-link file already covers `/auth/callback` (verified: reachable, correct app ID). Because it is a *different* domain than the one the auth journey runs on, iOS will hand the callback to the app.

**Scrolling / background** — nothing currently configures the native web view: no bounce setting, no background colour on the scroll area, no edge-swipe gesture. The page background is painted by CSS only, so the area revealed during an overscroll is the web view's default white.

## Plan

### 1. Provider button copy
- Apple button: "Continue with Apple" / "Fortsæt med Apple". Google unchanged.
- No change to email/password behaviour, password rules or auto-confirm.

### 2. Return to the app after sign-in
- Send the final callback to `https://open.setto.dk/auth/callback` on native only. Web sign-in keeps using `setto.dk` exactly as today.
- Accept both addresses when recognising the returned callback, so anything already in flight keeps working.
- Keep everything that already works: state check, Apple's secure code exchange, the single-owner callback rule, the sheet-closed grace window, keychain session restore.
- Before switching, confirm the new address is accepted by the sign-in provider settings and the backend's allowed-return list. If either rejects it, stop and report rather than shipping a half-working change.
- Only safe markers are logged — never codes, tokens or full return addresses.

### 3. Native scrolling, background and edge-swipe
One small native helper in the iOS shell, applied when the app's screen loads:
- Real rubber-band bounce from the web view's own scroll view (no JavaScript imitation).
- Web view, its scroll area and the window underneath all painted in the Setto background colour, so no white ever shows: `#F7F6F2` light, `#071C19` dark.
- The existing theme bridge is extended to push the current background to the native layer when the theme changes, including celebration mode.
- Left-edge swipe back enabled through the web view's own gesture.
- The bottom bar is fixed-positioned and unaffected by bounce.
- Web and installed-web-app behaviour untouched.

### 4. History hygiene
After a successful sign-in or a handled link, navigation uses replacement so an edge-swipe from the home screen can never go back to the sign-in or callback page. Password reset and invitation links keep their current behaviour.

## Tests
New/extended: callback recognition for both addresses, success/cancel/state-mismatch outcomes, Apple code exchange path, single-consumer rule, post-sign-in destination, deep links for invitation and password reset, and the native background colour mapping per theme.

Then: full test suite, typecheck, web production build, native production build, iOS sync.

## Still needs a real device (not claimable from tests)
Returning to the app from Google and from Apple, bounce feel with no white showing, edge-swipe back, theme switch on device, force-close session restore.

## Not touched
Account deletion, invitations and person identity, receipt scanning, calculations, status bar/safe areas, bottom navigation layout, routing framework.
