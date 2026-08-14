# PARI — UX refinement pass

A precision pass on navigation, real receipt input, and numeric input quality. No redesign: existing palette, typography, and screen compositions stay.

## 1. Bottom navigation

Five positions: Home — Groups — [ + Split ] — Activity — Profile.

- Remove the invisible spacer link currently used to fake balance; use a real five-column grid.
- Center mint action stays dominant (icon-led, no label) and opens the existing Split launcher sheet from every tab.
- Tighter native-iOS feel: reduced vertical height, softer shadow, kept safe-area padding, touch targets at least 44px.
- Active tab state stays as today (opacity + stroke weight); Profile tab highlights on `/profile`.
- Home header avatar keeps linking to `/profile`, so both entries share one destination.

## 2. Profile screen

Keep it minimal. Header (avatar + name), then one settings list: Personal details, Default currency (DKK), Appearance, Help, Sign out. The existing balance and People panels stay, trimmed so the page doesn't grow into a settings suite. Rows are non-functional placeholders except navigation already available.

## 3. Real receipt input

Remove auto-generated fake scans. New flow on `/split/scan`:

- Two real inputs: **Take photo** (file input with `capture="environment"`) and **Choose photo** (plain image picker). Both `accept="image/*"`.
- No image → no parsing. Buttons that continue stay disabled.
- After selection, the screen shows the actual image preview with: Retake / Choose another, Remove, and a primary **Read receipt**.
- If the camera input is unavailable or returns nothing, the Choose photo path stays visible — the user is never trapped.
- Tapping Read receipt shows "Reading receipt…" then routes to the existing review screen with parsed data.

## 4. Receipt parsing service

New `src/lib/receipt/parseReceipt.ts` exporting `parseReceipt(file: File): Promise<ParsedReceipt>`. For now it returns the existing demo items after a short delay, clearly marked internally as a temporary stub. The page component never contains parsing logic, so swapping in real OCR later requires no UI change. No developer wording appears in the UI.

## 5. Reusable numeric field

New `src/components/pari/NumericField.tsx` used by percentage, exact amount, shares, and the manual amount screen.

- `inputMode="decimal"`, select-all on focus with cursor-at-end fallback for mobile
- allows a temporary empty string while editing; commits `0` (or min) on blur
- optional prefix/suffix rendered as separate UI, never inside the value
- min/max clamping, formatting only on blur

## 6. Percentage editor

- `%` becomes a visual suffix; the input holds only the number.
- Exactly two participants: changing one auto-sets the other to `100 − value`.
- Always show the total: "Total 100% ✓" or "Total 92% · 8% remaining" in a calm tone; red only when the user attempts to save an invalid split. Continue/Save disabled unless the total is 100%.

## 7. Amount input

The manual amount screen uses NumericField with large numeric typography and the currency label as a separate element, so tapping selects the whole value for instant replacement.

## 8. Date bug

Demo dates currently derive from `new Date()` at module scope, which renders differently on server and client and can surface epoch dates. Replace with explicit, deterministic ISO timestamps in `src/data/demo.ts` (a fixed recent base date, offsets applied to that), so server and client agree and no 1969/1970 values can appear.

## 9. Money formatting

Central `formatMoney(amountMinor, currency, locale)` in `src/lib/money.ts`, wrapping the existing `formatMinor` behaviour with da-DK output (`4.293,83 DKK`). Components call the central formatter only.

## 10. Home spacing

No redesign. Only bottom padding / scroll padding adjusted so nothing hides behind the shorter nav bar, plus safe-area handling.

## Technical notes

- Files touched: `AppShell.tsx` (nav), `profile.tsx`, `split.scan.tsx`, new `parseReceipt.ts`, new `NumericField.tsx`, `PercentageSplitEditor.tsx`, `split.amount.tsx`, `split.share.tsx`/`split.result.tsx` where numeric inputs appear, `demo.ts`, `money.ts`.
- Object URLs for image previews are revoked on unmount to avoid leaks.
- No backend, OCR, or payments work in this pass.
