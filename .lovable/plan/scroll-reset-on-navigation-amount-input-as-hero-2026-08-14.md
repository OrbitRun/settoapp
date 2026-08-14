# Scroll reset on navigation + amount input as hero

Two separate fixes, no redesign.

## 1. Global scroll reset on route change

Audit result: PARI scrolls the window/document. `Screen` in `src/components/pari/AppShell.tsx` is a plain `min-h-svh` block with no inner `overflow-y` container, so the document is the scroll container. The only scrollable sub-container is the bottom sheet body, which is unrelated to routing. The router currently sets `scrollRestoration: true`, which restores a stored position and is the reason a freshly opened screen can inherit the previous screen's offset.

Behaviour to implement:

- A single reusable scroll-reset hook mounted once in the root layout (`src/routes/__root.tsx`), not per page.
- It subscribes to router location changes and, when the pathname changes on a forward navigation (`PUSH`/`REPLACE`), scrolls the document to 0 immediately after the new screen commits. It also defensively resets `document.scrollingElement` / `document.documentElement.scrollTop` so mobile Safari behaves.
- Search-param-only changes (e.g. `/split/result?expenseId=…` updating) and hash changes do not reset.
- Opening/closing bottom sheets and modals never triggers it — they don't change the route.
- Back/forward (`POP`) keeps TanStack's restored position, so returning from an expense to a scrolled Activity list lands where the user left off. Router keeps `scrollRestoration: true` for that purpose; the hook only overrides the forward case.

## 2. "Ny udgift" amount typography

Currently the numeric input renders an empty string at zero (so `0` shows as a faint placeholder), and `kr.` sits outside the sizing wrapper with a fixed 20px size, so the pair reads as two disconnected elements.

Changes, scoped to the amount block in `src/routes/split.amount.tsx` plus a small option on `src/components/pari/NumericField.tsx`:

- The amount and `kr.` become one centered `inline-flex` unit with baseline alignment and a small consistent gap; nothing is pushed to the right.
- Zero renders a real, fully opaque `0` in the input (not placeholder styling). The input gains an opt-in "show zero" behaviour so it displays `0` at rest and still clears/selects for easy replacement on focus.
- Length-aware sizing on the numeric part: ~60px up to 5 characters, ~52px to 7, ~42px to 10, ~32px beyond, so `500`, `2.500` and `25.000` all stay large and `1.250.000` shrinks only as needed. The invisible mirror span keeps the field exactly as wide as its content, so nothing overflows and there is no horizontal scroll.
- `kr.` scales with the amount (roughly a third of the numeric size, min ~18px) and stays baseline-aligned and secondary in colour.
- Font size does not change between display and edit mode, so focusing causes no jump. `inputMode="decimal"` and the ≥16px effective size rule stay, so Safari does not zoom.
- Danish formatting on blur (`2.500`, `2.500,50`) with raw editing while focused; internals stay integer minor units.
- Spacing between the title, amount and "Hvad var det?" tightens slightly so the amount doesn't float in an empty region. Participants, split method and the bottom button are untouched.

## Technical notes

- New `src/hooks/useScrollToTopOnNavigate.ts` (or `src/lib/scroll-reset.ts`), called from `RootComponent` in `src/routes/__root.tsx`, using `useRouterState` on `location.pathname` + `location.state` history action.
- `src/components/pari/NumericField.tsx`: add a `showZero` prop and a `suffix` sizing pass-through; no change to parsing/clamping.
- `src/routes/split.amount.tsx`: rework only the hero block.

## Verification

Run the acceptance walk in a browser at iPhone width: Activity scrolled far down → expense → Edit opens at top; scroll in Edit → next page at top; Back to Activity restores position; sheets don't move the page. Then type 0, 50, 500, 2500, 12500, 125000, 1250000, 2500.50 on "Ny udgift" and confirm size, centering and no overflow.
