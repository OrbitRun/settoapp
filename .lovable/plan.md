# Receipt Archive — Stage R1 audit (read only)

Nothing was changed. Findings first, then the proposed architecture and stages.

## 1. Current OCR flow

```text
photo picked (split/scan)  ->  client downscale to data URL  ->  parseReceiptImage server fn
   ->  Lovable AI Gateway (openai/gpt-5.6-sol, strict JSON schema)
   ->  ParsedReceipt  ->  draft in memory  ->  /split/review edit  ->  addExpense (DB)
```

- Input: `src/routes/split.scan.tsx`, two hidden file inputs (camera `capture="environment"` and library). Image-type check only, no size check client-side.
- Preprocessing: `src/lib/receipt/parseReceipt.ts` — `createImageBitmap` with EXIF orientation applied, longest edge capped at 2200 px, JPEG quality stepped 0.92 → 0.65, then a 0.7 shrink pass, target under ~4.5 MB encoded. Output is a `data:image/jpeg;base64` URL.
- OCR: `parseReceiptImage` (`src/lib/receipt/parseReceipt.functions.ts`, POST server fn, **no auth middleware**). Rejects >12 MB, 60 s timeout, sends system prompt + `image_url` data URL to `https://ai.gateway.lovable.dev/v1/chat/completions`.
- Persistence today: **none**. No Storage upload anywhere in the codebase; no original, no normalized copy. Only an in-page `URL.createObjectURL` preview and the transient data URL. Full parsed JSON exists only in the client draft.
- Errors: typed `CODE: message` strings, localized in the scan screen (timeout, rate limited, credits, too large, no receipt), with Try again / Retake / Choose another / Enter manually. Retry re-sends the same file.

## 2. Receipt data retained vs lost

Persisted on `expenses`: title, merchant, expense_date, currency, total_minor, original_currency / original_total_minor / exchange_rate(+date, source), card_charged_minor, source_type, `receipt_image_url` (**always NULL today — 0 of 20 rows set**). On `expense_items`: name, quantity, unit_price_minor, total_minor, category, is_shared, `confidence`, position.

Lost at save time: the image itself, merchant raw header and address lines, subtotal, receipt-level discount, per-line original unit price / discount amount / discount percent, currency confidence + evidence, total confidence, parser warnings, overall confidence, and the raw model JSON.

## 3. Storage bucket audit

Bucket `receipts`: private, no `file_size_limit`, no `allowed_mime_types`, **0 objects — entirely unused**. Four `storage.objects` policies already exist and all key on `auth.uid()::text = (storage.foldername(name))[1]`: read (SELECT), write (INSERT), update, delete. So the `<auth.uid()>/…` layout is already the enforced convention; no group-based path exists. No signed-URL usage anywhere in code.

## 4. Privacy model

Invariant: the original image is private to its owner; group participation never grants access. Current code has no violating path (nothing is stored or shared). The only latent risk is the legacy `expenses.receipt_image_url` text column: it is readable by every group participant through the expenses SELECT policy, so it must never hold a real URL or a path that is meaningful without owner-only storage RLS.

## 5. Recommended minimal `receipts` schema (v1)

Keep it small; put parser detail in JSON.

- `id uuid pk default gen_random_uuid()`
- `owner_user_id uuid not null references auth.users(id) on delete cascade`
- `storage_path text not null unique` (relative to bucket)
- `mime_type text not null`, `file_size_bytes bigint not null`
- `merchant_name text`, `purchase_date date`, `currency text`, `total_minor bigint`
- `parsed_json jsonb not null default '{}'` — address, subtotal, discounts, per-line detail, confidences, warnings, model/provider name, parsed_at
- `note text`, `warranty_expires_at date`
- `created_at`, `updated_at` (+ existing touch trigger)

Left out of v1 columns (live in `parsed_json`): merchant_address, subtotal_minor, discount_minor, ocr provider/model, width/height, original_filename, category. Promote to columns only when something filters or sorts on them.

## 6. Ownership FK

Recommend **A: `owner_user_id → auth.users ON DELETE CASCADE`, NOT NULL**. Receipts are private account data, unlike shared financial history; cascade is the correct default and makes an orphaned private row impossible. Storage objects are not cascaded, so the account-deletion path must delete objects explicitly (section 14).

## 7. Expense → receipt relation

`expenses.receipt_id uuid null references public.receipts(id) on delete set null`. Deleting a receipt or an account keeps the shared expense with `receipt_id = NULL`; group members never gain image access because access is decided by `receipts` RLS + storage RLS, not by the expense.

Migration from `receipt_image_url`: the column is unused (0 rows), so no data migration is needed — add `receipt_id`, stop writing the text column, and drop it in a later cleanup stage.

## 8. RLS model for `receipts`

Grants: `SELECT, INSERT, UPDATE, DELETE` to `authenticated`; `ALL` to `service_role`; **no anon grant**. Enable RLS, then a single policy per command, all `TO authenticated` with `owner_user_id = auth.uid()` in USING and WITH CHECK. No group-participant exception, no group-owner exception, no security-definer helper.

Authority source: the table row uses `owner_user_id`; the object uses the `auth.uid()` folder prefix. Both must agree — enforce it by requiring `storage_path` to start with `owner_user_id || '/'` (check constraint or trigger), so a row can never point at another user's object.

## 9. Storage path and policies

Layout `<auth.uid()>/<receipt_id>/original.jpg`. The receipt id is a random uuid, so paths are unpredictable. The existing four bucket policies already implement exactly owner-only read/write/update/delete on this prefix — no policy change needed. Store only the relative path; display uses a short-lived `createSignedUrl` (≈60 s) generated on demand, never persisted.

## 10. Image, MIME, size

Recommend **B: archive the normalized OCR image** for v1 — the same 2200 px JPEG that is already produced. It is proof-of-purchase legible, one upload, no second encode, and canvas re-encoding **already strips EXIF including GPS**, which resolves the metadata concern for free. Storing the original (A/C) doubles cost and re-introduces EXIF for marginal quality gain; revisit if warranty use demands it. Limits: `image/jpeg`, `image/png`, `image/webp`, `image/heic`, 10 MB per object.

## 11. OCR privacy and disclosure

The image goes to the Lovable AI Gateway and on to the OpenAI model — it leaves the EU-hosted backend. No provider retention terms are documented anywhere in the codebase, and the scanner currently shows no processing disclosure. **This is an open legal/privacy-policy gap** — no retention guarantee should be asserted until confirmed. Proposed scanner copy: "Billedet sendes til en AI-tjeneste, der læser varer og beløb. Kvitteringen gemmes privat på din konto."

## 12. Save flow

Recommend **Option B**, receipt written together with the expense after confirmation, with the upload just before:

1. Scan → OCR on the in-memory data URL (unchanged, nothing stored).
2. User reviews and confirms.
3. Upload the normalized JPEG to `<uid>/<new uuid>/original.jpg`.
4. Insert the `receipts` row with that id and path, then create the expense with `receipt_id`.

Compensation: upload OK but insert fails → delete the just-uploaded object, surface a retry; insert OK but expense fails → keep the receipt (it is valid archive data on its own) and let the user link or retry; upload fails → save the expense without a receipt rather than losing the split; OCR fails → today's error UI, nothing stored; user cancels after OCR → nothing was written yet. A periodic sweep for `receipts` rows whose object is missing is the backstop. Option C (fully independent archive) stays reachable later — this flow is a strict subset of it.

## 13. Private archive UX

A new "Kvitteringer" section, reached from Profile rather than a sixth nav slot (nav is already at five). Cards: merchant, date, amount, thumbnail via short-lived signed URL, linked-expense indicator. Detail: full image, parsed merchant/date/total, items, note, linked expense, warranty date. Only the owner ever sees this surface.

## 14. Shared-expense behaviour

Owner sees a "Vis kvittering" action on the expense. Other participants see the expense and items exactly as today and get **no indicator at all** — knowing a private image exists invites requests for it and adds no value to a co-participant. Recommend omitting the indicator in v1.

## 15. Account-deletion integration (design only)

Inside the existing `deleteMyAccount` server fn, before `auth.admin.deleteUser`: list `storage.objects` under the user's prefix via the admin client and remove them, then delete the receipt rows (or let the FK cascade do it). Because object deletion is not transactional, treat leftovers as retryable: the whole flow is already idempotent, a second run finds fewer objects and still succeeds, and auth deletion should not be blocked by a storage error alone — log it and let a sweep reclaim orphans. Expenses survive via `receipt_id ON DELETE SET NULL`.

## 16. GDPR / export

A future export should include receipt metadata, parsed OCR JSON, and the original images. Retention notes: images are the most sensitive artefact in the product (addresses, card fragments, purchase patterns); keep them owner-only, never public-URL, and document the AI-processing step in the privacy policy before shipping the archive.

## 17. Staged plan (3 stages)

- **R2 — foundation:** `receipts` table + grants + RLS + path check constraint, `expenses.receipt_id`, bucket MIME/size limits. Storage policies already correct.
- **R3 — capture + link:** upload in the save flow, receipt row + expense written together, compensation paths, owner-only "Vis kvittering" with short-lived signed URLs, scanner disclosure copy.
- **R4 — archive + deletion:** Kvitteringer list/detail UI, note and warranty fields, storage cleanup in `deleteMyAccount`, drop `receipt_image_url`.

## 18. Risks and open questions

- Provider retention terms unknown — legal gap, blocks final privacy copy.
- `parseReceiptImage` has no auth middleware; once uploads are attached, the capture path must be authenticated (guest scanning must stay non-persisting).
- Guest mode has no account: guests can scan but cannot archive; needs a decision on whether a post-signup migration carries the image over.
- Bucket has no size or MIME limits yet — set in R2.
- Thumbnails are full-size images until a resize step exists; acceptable at current volume.

## 19. Baseline confirmed

groups 2 · people 10 · group_members 5 · expenses 20 · expense_items 105 · expense_splits 48 · item_splits 0 · settlements 1 · activity 69 · invitations 5 · split sum 1,892,653 øre. `receipts` bucket: private, 0 objects. `expenses.receipt_image_url`: 0 non-null rows. Nothing was modified.
