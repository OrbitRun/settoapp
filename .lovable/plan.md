# Receipt parsing that helps instead of rejecting + a hero amount again

Two fixes: make receipt reading resilient and debuggable, and restore the big centered amount on "Ny udgift".

## 1. Receipt parsing — find the real failure

Today every problem (network, model error, unreadable JSON, empty items) collapses into one Danish message, and the client `catch {}` throws away the reason, so nothing can be diagnosed. What changes:

- The server parser gets typed failure codes: `IMAGE_MISSING`, `IMAGE_TOO_LARGE`, `AI_REQUEST_FAILED`, `AI_TIMEOUT`, `AI_INVALID_RESPONSE`, `SCHEMA_VALIDATION_FAILED`, `NO_RECEIPT_DETECTED`, `NO_ITEMS_DETECTED`, `TOTAL_NOT_FOUND`.
- Stage logging in server logs: parse started, image bytes + mime, AI request started, AI response received (status, duration), schema validated, success or failure code. No keys, no image content, nothing user-visible.
- The user still sees simple Danish copy, but the code travels with the error so retry/logging can use it.

## 2. Partial receipts are accepted

A receipt is only rejected when nothing financial can be read. Missing merchant, date, subtotal, tax, or a shaky line no longer fails the parse — the result carries `warnings[]` and a confidence value, and the Review screen opens with a soft note: "Vi fandt kvitteringen, men nogle linjer skal tjekkes." From there the user edits names, prices, total and merchant, adds a missing line, deletes a wrong one — the editing tools that already exist there.

Cases that now succeed instead of failing: total found but no items (one editable line seeded from the total); items found but no total (total summed from items); merchant/date missing (left blank).

## 3. Schema and prompt

- Optional fields become nullable in the structured schema (merchant, date, currency, subtotal, tax, discount, per-item confidence), so a good AI answer can't fail validation on an absent field.
- The vision prompt is rewritten: read the actual image, extract every visible purchased line, never invent items, keep quantities/discounts/line totals, expect Danish, Swedish, Norwegian, German or English wording (TOTAL, I ALT, AT BETALE, MOMS, RABAT, ANTAL, VARE, KORT, KR.), prefer lower confidence over failing, the final amount paid is the most important field, return null rather than a guess. No store-specific templates.

## 4. Image quality and orientation

- Preview stays cheap, but the image sent to the AI keeps enough resolution for small print: longest edge up to ~2200px (only downscaling when larger) and higher JPEG quality, with a size ceiling so uploads stay sane; if the encoded image exceeds the ceiling, quality steps down before dimensions do.
- EXIF orientation is applied when re-encoding, so an iPhone photo reaches the parser upright even though the browser preview looks fine.

## 5. Retry without retaking the photo

On failure the scan screen keeps the selected image and offers: "Prøv igen" (same image), "Tag nyt billede", "Vælg et andet billede", "Indtast manuelt". Danish and English strings added to the existing i18n dictionary.

## 6. Manual amount — hero again

On "Ny udgift" the amount becomes a large, centered, dominant display that is itself the editable input: value around 56–64px semibold, "kr." rendered smaller and baseline-aligned next to it, the pair centered as a unit (not right-pushed). Typography steps down only for long values (roughly 8+ characters), so 500, 5.000 and 12.450,50 all stay big. Numeric keyboard, select-on-focus, and ≥16px effective input size are preserved — it stays a real `<input>`, not decorative text with a hidden field. "Hvad var det?" stays directly below; the "Ny udgift" title stays the small centered nav title.

## Not touched

Participant stepper, temporary people, all split modes, live calculations, sticky Færdig, guest/auth separation, safe areas, localization.

## Technical notes

- `src/lib/receipt/parseReceipt.functions.ts`: nullable schema, new prompt, `AbortController` timeout mapped to `AI_TIMEOUT`, staged `console.log`/`console.error` with a `[receipt]` prefix, structured `{ code, message }` errors, partial-result assembly (total-from-items, items-from-total) and `warnings`/`confidence` in the payload.
- `src/lib/receipt/parseReceipt.ts`: orientation-aware, higher-fidelity re-encode; propagate error codes; return warnings.
- `src/routes/split.scan.tsx`: keep the file after failure, retry actions, code-specific user copy.
- `src/routes/split.review.tsx`: warning banner when warnings exist.
- `src/routes/split.amount.tsx`: hero amount block with responsive size class.
- `src/lib/i18n.tsx`: new keys (retry actions, warning banner, failure copy).

## Verification

Run the flow in a browser against several receipt photos (supermarket, retail, restaurant, long, angled), confirm real extracted data appears, confirm a receipt with an unreadable optional field still reaches Review, and confirm the server log names the exact failure code when a parse genuinely fails.
