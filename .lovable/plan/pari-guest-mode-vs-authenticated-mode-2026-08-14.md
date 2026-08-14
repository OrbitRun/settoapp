# PARI — Guest mode vs authenticated mode

Separate PARI into two clean states: a standalone guest flow (welcome → split → result) and the existing authenticated app. Nothing in the current split experience, design or Danish localization is redesigned.

## 1. Routing model

Today the dashboard lives at `/` and shows a welcome screen only when a guest has no expenses — so a guest who finishes a split lands on the authenticated Home ("God eftermiddag, Mig"). New model:

```text
/                 unauthenticated -> Guest Welcome
                  authenticated   -> redirect to /home
/home             authenticated dashboard (protected)
/groups, /activity, /profile, /expense/*, /settle/*, /groups/*   protected
/auth             login + signup, reached only by explicit tap
/split/*          open to everyone (guest and authenticated)
```

Protected routes redirect unauthenticated visitors to `/` (Guest Welcome), never to `/auth`. Redirect happens after the session check resolves, so a signed-in user never flashes the welcome screen.

## 2. Guest Welcome (canonical unauthenticated root)

Keeps the current welcome visual style. Content:
- Primary: "Split en udgift" → `/split/start`
- Secondary: "Log ind" → `/auth`
- Tertiary: "Opret konto" → `/auth?mode=signup`

No bottom navigation anywhere in guest mode.

## 3. Split start chooser (`/split/start`)

New focused screen with two cards, both available without login:
- "Scan kvittering" — "Tag et billede – PARI finder varerne" → `/split/scan`
- "Indtast beløb" — "Tilføj beløbet selv" → `/split/amount`

The authenticated `+` bottom-nav sheet keeps its current behaviour.

## 4. Bottom navigation

`BottomNav` renders nothing for unauthenticated users. Guest split screens use the existing flow header with back navigation instead. Authenticated users keep the 5-position nav unchanged.

## 5. Receipt scanning for guests

Scanning already runs through the real AI parser server function and never required auth — the plan keeps it that way and verifies the full guest chain works end to end: photo/upload → parse → review merchant and items (edit, delete, add) → participants → item assignment / shared items → result. No demo receipt data. The parser stays a single isolated service call (`src/lib/receipt/parseReceipt.ts`) so a future entitlement check can wrap it; no limits, payments or subscriptions in this iteration.

## 6. Result screen (guest)

Keeps the allocation card. Guest action hierarchy:
1. "Del resultat" (existing native share / copy)
2. "Gem i PARI" — replaces "Gem som gruppe"
3. "Nyt split" — clears the finished draft and goes straight to `/split/start`
4. "Færdig" — returns to Guest Welcome (`/`), never Home

Authenticated users keep their current result actions.

## 7. "Gem i PARI" sheet

Reuses the existing account sheet with new copy:
- Title "Gem dit split"
- Body "Opret en konto for at gemme udgiften, personerne og din historik i PARI."
- Actions "Opret konto", "Log ind", "Ikke nu"

The pending guest split already persists in local storage across the auth redirect and migrates after sign-in; after migration the user is sent to `/home`.

## 8. "Mig" stays local

The guest self-participant remains a temporary local person only: no profile creation, no authenticated shell, and it can no longer produce a Home greeting because Home is unreachable while unauthenticated.

## 9. Logout

Profile "Log ud" signs out, clears session and cached authenticated data, resets guest local state, and navigates to `/` (Guest Welcome) with history replace. Nothing redirects to `/auth` on sign-out.

## 10. Bottom sheet fix

"Sådan deles det" and every other sheet: horizontal inset so it never touches the viewport edge, rounded top corners preserved, `max-h` with internal vertical scroll, `padding-bottom: env(safe-area-inset-bottom)`, and no horizontal overflow.

## 11. Mobile web / zoom audit

- All interactive inputs (amount, percentage, exact, item name/price, auth fields) get a minimum 16px font size on mobile so iOS Safari does not auto-zoom on focus.
- Verify no element exceeds viewport width (`overflow-x` audit on the split flow and sheets).
- Keep the existing `viewport-fit=cover` meta; no `user-scalable=no`, accessibility zoom stays intact.
- Confirm safe-area padding on top bars, sheets and fixed nav.

## Technical notes

- Move the current dashboard component from `src/routes/index.tsx` to a new `src/routes/home.tsx`; `index.tsx` becomes Guest Welcome plus a signed-in redirect.
- Add `src/routes/split.start.tsx`.
- Add a small shared session guard used by `groups*`, `activity`, `profile`, `expense.$expenseId`, `settle.$groupId` and `home`, driven by the existing store's `authReady` / `isGuest` state (client-side, `ssr: false` where needed) so no prerender auth calls occur.
- `BottomNav` early-returns for guests; guest split screens keep `FlowHeader`.
- New i18n keys for the welcome actions, the split chooser cards, and the "Gem dit split" sheet, in both languages.
- Fixes the existing hydration mismatch by keeping the time-based greeting on the authenticated home only, behind the hydration check.

## Preserved

Temporary people, person-count stepper, equal/percentage/shares/exact splits, live calculation, guest local persistence, the premium visual design, mobile scroll/layout fixes, the Danish localization architecture and the full authenticated experience.
