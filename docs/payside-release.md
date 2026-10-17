# Payside controlled rebrand — release handover

## 1. Scope and source identity

Payside is the existing shared-expense app, not a new app or a payment processor. No production records, migrations, account identities, signing identities, OAuth clients, storage keys or invitation semantics were changed for this rebrand. Nothing was published, uploaded to TestFlight or submitted to the App Store. The installed iPhone app has not changed.

Branch checked: `edit/edt-010b567f-8e68-4ff1-8a6c-f1bc7d3bf860`. Baseline checked before rebrand: `625393ad2231b0f16caaa292a0061038c5a689a8`. Latest observed commit before writing this handover: `80dd9f97bf7dd77194ce6b6bbb7e107a59ea4e0b`. Lovable manages commits during editing; this is an observed reference, not a claim that the final handover is in that commit or on `main`.

## 2. Implemented files

Visible wording, route titles, descriptions and social metadata were updated in:

```text
src/routes/__root.tsx
src/routes/activity.tsx
src/routes/auth.callback.tsx
src/routes/auth.index.tsx
src/routes/expense.$expenseId.tsx
src/routes/groups.$groupId.tsx
src/routes/groups.$groupId_.edit.tsx
src/routes/groups.index.tsx
src/routes/groups.new.tsx
src/routes/home.tsx
src/routes/index.tsx
src/routes/invite.$token.tsx
src/routes/onboarding.tsx
src/routes/profile.tsx
src/routes/receipts.tsx
src/routes/reset-password.tsx
src/routes/settle.$groupId.tsx
src/routes/split.amount.tsx
src/routes/split.items.tsx
src/routes/split.result.tsx
src/routes/split.review.tsx
src/routes/split.scan.tsx
src/routes/split.share.tsx
src/routes/split.start.tsx
src/lib/i18n.tsx
src/lib/email-copy.ts
src/data/store.tsx
```

`store.tsx` changes are limited to the product-name fallback; this is not an invitation or expense logic refactor. Reset-password wording uses the existing translation system. Static canonical URLs and `og:url` still self-reference the current `https://setto.dk` host; they must be updated only with the eventual verified domain cutover. Share images were not fabricated.

Artwork and display configuration:

```text
src/components/pari/Wordmark.tsx
src/components/pari/SettledCelebration.tsx
src/assets/payside-wordmark.png.asset.json
src/assets/payside-wordmark-light.png.asset.json
src/assets/payside-mark-light.png.asset.json
src/assets/payside-app-icon-1024.png.asset.json
public/favicon.png
public/apple-touch-icon.png
public/manifest.webmanifest
capacitor.config.ts
ios/App/App/Info.plist
ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json
ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png
ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png
ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png
```

Removed unused old native dark/tinted icons:

```text
ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x-dark.png
ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x-tinted.png
```

Handover and contributor guidance: `README.md`, `AGENTS.md`, `roadmap.md`, and this file. An automatic platform update also changed `bun.lock` (including the Lovable Vite configuration package from 2.25.3 to 2.26.5 and router-generator resolution). This was not a deliberate rebrand dependency upgrade; do not describe the overall lockfile as unchanged. No dependency-install command was issued for the rebrand.

## 3. Approved PNG assets

| Supplied asset | Dimensions | Transparency | Use |
|---|---:|---|---|
| payside-wordmark.png | 1024 × 285 | Yes | Wordmark on light surfaces |
| payside-wordmark-light.png | 1024 × 285 | Yes | Wordmark on dark surfaces |
| payside-mark-light.png | 1024 × 1169 | Yes | Settlement celebration and proportionally centered native launch mark |
| payside-app-icon-1024.png | 1024 × 1024 | No | Exact default native icon; web manifest icon; 180px derived Apple touch icon |
| payside-favicon-32.png | 32 × 32 | No | Browser favicon |
| payside-logo-horizontal.png | 1024 × 280 | Yes | Inspected, not needed by current layouts |
| payside-logo-horizontal-light.png | 1024 × 280 | Yes | Inspected, not needed by current layouts |
| payside-logo-stacked.png | 1024 × 1007 | Yes | Inspected, not needed by current layouts |
| payside-logo-stacked-light.png | 1024 × 1007 | Yes | Inspected, not needed by current layouts |
| payside-mark.png | 896 × 1024 | Yes | Inspected, not used |
| payside-app-icon-light-1024.png | 1024 × 1024 | No | Inspected, not assigned an appearance |
| payside-app-icon-1024-tinted.png | 1024 × 1024 | No | Inspected; custom mint artwork is not proof of Apple tinted-template compliance; not assigned |

Web originals are referenced through CDN asset pointers. Native icon is byte-for-byte the supplied primary PNG. The launch canvases and Apple touch icon are platform-sized derivatives, preserving the mark's aspect ratio and colours; no SVG conversion, tracing, cropping or redrawing was used.

## 4. Colours and retained Setto references

`src/styles.css` is unchanged against the baseline: palette, typography, layout and existing animations remain. The artwork itself uses dark green `#0C3026`, off-white `#FBF9F5` and mint `#71DABE`; these are not identical to the existing app's warm off-white `#F7F6F2`, native dark surface `#071C19` and semantic green/mint tokens. The small colour difference is visible between artwork, icons/launch mark and surrounding surfaces. Neither app nor logo was recoloured.

Remaining Setto references are intentional categories:

- Stable native identity: `dk.setto.app`, Swift/Capacitor plugin names, Apple Services ID and signing configuration.
- Working-origin contracts: `setto.dk`, `open.setto.dk`, legacy `settoapp.lovable.app`, callback constants, broker origin, invitation links, reset links, current canonical URLs and associated domains.
- Persistence: guest, privacy, auth and secure-session namespaces. Renaming or moving origins could strand existing data or sessions.
- Internal function and animation names, comments, test fixtures and contributor history; these do not display a product brand to users.
- Historical release notes and database migrations; no historical records were rewritten.
- Old unused public artwork and an old asset pointer remain for compatibility with earlier published versions. They are no longer the current Wordmark/celebration source; CDN deletion could break older deployments.

## 5. External configuration — not performed

Domain checks found `payside.dk` and `payside.app` not connected to this Lovable project; their nameservers were at Simply (`ns1.simply.com`, `ns2.simply.com`, `ns3.simply.com`). Ownership does not mean these domains currently host this app. No exact hosting records are available until the domain connection flow supplies them; do not invent an IP address or verification TXT value.

1. **Prepare hosting.** In Project Settings → Domains, connect `payside.dk`, then `payside.app`. Use the exact records shown by Lovable at Simply. Wait for verified HTTPS and test all existing routes without setting a primary domain or blanket redirect yet.
2. **Prepare auth and links.** Review the hosted auth site URL and redirect allowlist for OAuth callback, password reset and email confirmation. Add the new required full callback URLs while retaining old ones. Review Google OAuth authorised origins/redirect URIs and Apple Services ID domain/return URLs; keep current provider client IDs and bundle identity. Native auth currently uses `https://open.setto.dk/auth/callback`; changing that requires a coordinated JS callback allowlist, Swift ASWebAuthenticationSession callback, entitlement and HTTPS/AASA update, not just DNS. The existing context reported a provisioning failure for `open.setto.dk`; recheck that domain separately before claiming native callback readiness.
3. **Verify on both accounts.** Exercise old and proposed new invitation/join routes, signed-out/signup and signed-in acceptance, password reset and Google/Apple return to the app. Fetch `/.well-known/apple-app-site-association` without an HTML wrapper and verify its app identity remains `PPRV986F35.dk.setto.app`. Add only verified new Universal Link domains to entitlements and ship an iPhone build containing them before expecting installed-app handling.
4. **Switch new URLs only after success.** Change newly generated invitation/reset/callback URLs and canonical host together after readiness. Keep old paths, query parameters and fragments compatible; do not rewrite invitation tokens or historical links.
5. **Protect existing web data before redirects.** Local storage and sessions on `setto.dk` are not available automatically on `payside.dk`. Keep old-origin access while designing and testing an explicit authenticated migration/export approach for guests and sessions. Only then add selective safe redirects; avoid blanket primary-domain redirects that intercept auth/native callbacks.

**Email:** The repository's email-copy defaults now say Payside, but a search found no current caller of `emailCopy()`. Therefore this is not evidence that delivered hosted emails were changed. Email-domain access showed only `takstapp.dk` verified, not a Payside sender. Review actual auth templates, sender display name, transactional invitations and confirmation/reset/email-change links through Lovable's email settings. Verify a Payside sender domain and its supplied DNS records before changing a sending address. No hosted template was changed, and no support mailbox was invented.

**Support/privacy:** No existing operational support email or standalone privacy URL was found in the inspected current route/public sources. Do not invent one. Supply and verify the real support/privacy URLs before entering them in App Store Connect. Existing informational profile/help copy was rebranded; hosted legal/contact settings still need owner review.

## 6. Validation results

Commands used (existing dependencies; no package installation):

```sh
npm exec -- vitest run src/lib/member-mutations.test.ts src/lib/expense-save.test.ts src/lib/group-people.test.ts src/lib/invite-sync.test.ts src/lib/native-auth.test.ts src/data/invitations.test.ts
npm exec -- vitest run
```

- Focused suites: 6 files / 45 tests passed.
- Full suite: 14 files / 86 tests passed, including atomic-expense client tests, member mutation checks, historical people, invitation sync and native-auth unit tests. These do not prove a two-phone flow or a native Swift build.
- Preview compiler: latest inspected harness entry reported **build OK**. All 23 content routes have their own head metadata, including index.
- Browser: public welcome/auth/onboarding and invalid-invitation state checked; an existing authenticated account's home, group list, existing group details and settings read back successfully. Runtime-error listener reported none. Artwork loaded and no horizontal overflow was observed at 390px and 729px; dark-mode light wordmark loaded. Private account content was masked in inspection images.
- Native launch artwork was inspected as a raster image. This is not an iPhone launch test. A valid invitation acceptance, provider login, removal/re-invitation or password reset was not executed in this rebrand browser check.
- **Standalone typecheck: NOT RUN.** Project has no typecheck script and no installed `tsgo`; sandbox rules reserve project build/typecheck execution to the automatic harness. No standalone result is claimed.
- **Production web build: NOT RUN separately.** Only automatic preview compilation was observed; this is not equivalent to `npm run build`.
- **Native web build: NOT RUN.** No generated `dist/client` output was available; no separate native result is claimed.
- **iOS sync: NOT RUN.** Existing script includes a manual native build, which this sandbox must not run; Xcode is also unavailable here. No new native bundle was synchronized.
- **Xcode archive / physical iPhone testing: NOT RUN.** Requires the owner's Mac, signing and two actual accounts on devices.

## 7. Exact npm-based iPhone build steps (owner's Mac)

Use the connected branch/revision containing this change, not an assumed `main`. Check these prerequisites before changing dependencies:

```sh
git branch --show-current
git rev-parse HEAD
npm run
npm exec --no -- vitest run
```

This repository currently has `bun.lock`, not an npm lockfile, and no `test` or `typecheck` script. Do not run `npm ci` against a nonexistent `package-lock.json`, or run an install that silently adds/updates a lockfile. Use already-provisioned matching dependencies; if unavailable, agree a reproducible npm dependency/lockfile setup separately rather than treating it as part of this rebrand.

With the project's dependencies installed and an approved local `tsgo` tool available:

```sh
npm exec --no -- tsgo --noEmit
npm run build
npm run build:native
npm run ios:sync
npm run ios:open
```

`build:native` is `SETTO_NATIVE=1 vite build`. `ios:sync` intentionally rebuilds with the same native flag and then runs `cap sync ios`, copying `dist/client` into the iOS project. Do not sync an ordinary server-oriented web build instead. The `tsgo` command requires an available tool and is a requested local check, not a result from this sandbox.

In Xcode, verify display name Payside, supplied default icon, signing team, unchanged bundle `dk.setto.app`, iOS deployment target 17.4, associated domains and authentication capabilities. Current project marketing version is 1.0 and build number 1; choose the next unused build number if any prior upload used 1. Do not create a second app identity. Run on devices first; archive only when these checks pass. Upload/submission is intentionally outside this task.

## 8. Two-phone checklist — awaiting owner testing

1. Install the newly synced Payside build on both phones over the existing app; check home-screen name/icon and warm/dark launch surfaces. Confirm existing sessions/data survive.
2. Owner and recipient sign in to their original accounts, including Google/Apple where applicable; verify automatic return, cancellation and subsequent retry.
3. Open an old `setto.dk` invitation on the recipient phone while signed out, then while signed in. Confirm fresh account data contains the group before it opens; no transient “group gone” error.
4. Once new domains are fully ready and URL generation is intentionally switched, repeat with newly generated Payside invitation links. Verify old links still work with their original paths and parameters.
5. Owner removes an account-linked participant before any expense: owner sees exactly one Former member row and Invite again; recipient loses access. Send a fresh invitation to that historical person; acceptance restores the same membership/person without duplicates. A used/revoked old invitation must not reactivate a later removed member.
6. Repeat re-invitation with existing expenses/history. Check original person identity, historical expenses, payer/splits and balances on both accounts.
7. Test password reset from old links and new links once ready, including return to the installed app and successful login with the new password.
8. Exercise a guest split followed by signup with a pending invitation; verify guest migration priority and recoverable invitation-sync retries remain intact. Edit an existing expense and confirm all replacement splits save together; verify no false removal success.

Do not label these checks verified until performed on two real accounts/devices.

## 9. App Store Connect / Apple Developer — manual

- Rename the existing app listing to Payside (subject to availability), including Danish/English localizations, subtitle/description and screenshots. Keep shared-expense positioning; do not imply payment processing.
- Review the existing App Store Connect record and bundle identity instead of creating a new one. The submitted build supplies its app icon; verify icon preview after a future upload.
- Update real support/marketing/privacy URLs only when operational; review app privacy disclosures rather than changing them merely for a name change.
- Update Apple sign-in consent/display branding and verified web domains/return URLs separately when cutting over domains; retain Services ID, team and bundle.
- Choose a release version/build number and update review notes with working login/testing instructions after device QA. No upload or submission was performed here.

## Status separation

**Implemented:** visible brand, approved web/native artwork, display metadata and handover.

**Automated/preview verified:** 86 tests, preview compilation, representative public and existing-account reads, artwork loading and selected screen widths/dark mode.

**Externally configured:** no new Payside domain, auth provider, sender, App Store listing or redirect configuration was applied.

**Still required:** standalone local typecheck, production/native builds, iOS sync/Xcode archive checks, domain/email readiness and the two-phone checklist.