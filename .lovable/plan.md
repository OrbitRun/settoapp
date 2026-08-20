# PARI — Backend, storage and privacy audit (read-only)

Nothing was changed. All findings come from reading the code and querying the database catalog.

## 1. Current architecture

TanStack Start (React 19, Vite) frontend, Lovable Cloud (Supabase Postgres + Auth + Storage) backend. Server logic runs as TanStack server functions (`src/lib/receipt/parseReceipt.functions.ts`, `src/lib/fx.functions.ts`) on the edge worker; there are no Supabase edge functions. Most data access goes directly from the browser client to PostgREST under RLS (`src/data/store.tsx`, ~1400 lines, TanStack Query). Guest mode keeps a full parallel dataset in `localStorage` (`src/data/guest.ts`) and migrates it on sign-up.

## 2. Database region

`aws-0-eu-north-1` (Stockholm, EU). Instance size Tiny. Good baseline for GDPR — data stays in the EU. The AI gateway call is a separate egress path (section 7).

## 3. Source-of-truth model

| Concept | Source of truth |
| --- | --- |
| Identity | `auth.users` → `profiles` (1:1) |
| Person (may be unclaimed) | `people`; `linked_profile_id` NULL = placeholder, set = claimed |
| Group membership | `group_members` (`removed_at IS NULL` = active) |
| Expense ownership | `expenses.owner_user_id` (creator), `paid_by_person_id` (payer) |
| Participants | `expense_splits` (per person amount/percentage/shares) |
| Item-level participation | `expense_items` + `item_splits` |
| Balances | Derived at runtime from expenses + splits − settlements. Nothing precomputed. |
| Settlements | `settlements` rows, including partial payments |
| Invitations | `group_invitations` (`token`, `join_code`, `status`, `sent_at`, optional `person_id`) |
| History | `activity` with JSON `metadata` change sets |

Every table carries a denormalized `owner_user_id` that RLS keys off. This is the single most load-bearing design decision in the schema: it means "who created the row", not "who the row is about".

## 4. RLS / auth model

All tables have RLS enabled. The pattern is: `own X` (`ALL` to `authenticated` on `auth.uid() = owner_user_id`) plus, on some tables, a read policy through `is_group_participant(group_id, auth.uid())` (SECURITY DEFINER, checks group owner OR active member linked to the caller's profile).

Participant read policies exist on: `groups`, `group_members`, `people`, `expenses`, `expense_splits`, `expense_items` (shared items, or private items the caller is split into).

SECURITY DEFINER functions: `is_group_participant`, `handle_new_user`, `get_invitation_preview`, `claim_group_invitation`, `redeem_group_invitation`, `accept_group_invitation`. All set `search_path = public`. They are correctly scoped, and the invitation functions gate on `auth.uid()`.

Weaknesses found (not fixed):

- **No participant read policy on `settlements` or `activity`.** Only the row creator can read them. A member who did not create a settlement cannot see it, and balances/history are asymmetric per user. This is the same class of bug as the earlier invisible-balances incident.
- **No participant read policy on `item_splits`.** Item assignments are only readable by the creator, while `expense_items` is readable by participants.
- **Writes are not membership-checked.** `own expenses ALL … auth.uid() = owner_user_id` lets any authenticated user insert an expense with an arbitrary `group_id`, including a group they do not belong to. Same for `group_members`, `settlements`, `activity`. Nothing leaks, but foreign rows can be pushed into other people's groups.
- **`fx_rates` is world-writable to authenticated users** (`INSERT … WITH CHECK true`, no update/delete). Cache poisoning would silently change conversion of new expenses.
- **`get_invitation_preview` is SECURITY DEFINER and callable by anyone holding a code** — returns group name, inviter name, member count, person name. Intentional for the invite landing page, but it is an unauthenticated-equivalent disclosure surface, and short `join_code` values are guessable if not rate-limited.
- Unclaimed placeholder people are safe: they are readable only through group participation, and claiming refuses when `linked_profile_id` is already set (`person_taken`).

## 5. Receipt scanning flow (current)

`split/scan` → user picks/takes a photo → the browser downscales to max 2200 px and re-encodes JPEG (quality stepped 0.92→0.65, target < ~4.5 MB) into a data URL → the `parseReceiptImage` server function posts it to the Lovable AI gateway → structured JSON comes back → the parsed result is written into the in-memory split draft → review/split screens → on save, only the derived expense data is persisted.

**The original receipt image is never persisted anywhere.** No upload call exists in the codebase; `expenses.receipt_image_url` exists in schema and types but is always `null`. The blob URL is revoked when the scan screen unmounts.

What is persisted: `expenses` (merchant, title, date, currency, totals, FX rate/date/source, card charged) and `expense_items` (name, quantity, unit price, total, category, shared flag, confidence, position) plus splits. Discounts survive only folded into effective unit prices — `discountMinor` / `discountPercent` / `originalUnitPriceMinor` live on the draft type but have no columns. Store address (`merchantAddress`), raw merchant header, warnings and receipt-level discount are also draft-only and lost at save.

A) Private/archive data today: nothing. B) Shared data: everything that is saved is visible to all group participants.

## 6. Storage setup

One bucket, `receipts`, created 2026-08-14, **private**, no size limit, no MIME allow-list. Three policies on `storage.objects`, all `authenticated` only, all keyed on the first path segment equalling `auth.uid()`: SELECT, INSERT, DELETE. No UPDATE policy. No `anon` access, so images cannot become public unless the bucket is flipped to public. No signed URLs are generated anywhere — nothing is uploaded yet. The bucket is effectively an unused, correctly-locked shell.

## 7. AI / OCR data flow

Provider: Lovable AI gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`), model `openai/gpt-5.6-sol`, 60 s timeout, 12 MB server-side ceiling, JSON-schema-constrained output. The key is read inside the handler; it never reaches the browser.

- The image **does leave our infrastructure** — the full receipt photo is sent to the gateway and on to the model provider, outside Supabase and outside our EU region guarantee.
- We persist no copy: no temp files, no bucket write, no DB blob. The data URL exists in browser memory and in the request body only.
- Server logs record status, item counts, totals, warnings, timings — no image bytes and no line-item names.
- Privacy considerations: receipts commonly contain pharmacy/alcohol/medical purchases, card last-4, loyalty IDs and location. There is currently no user-facing disclosure that the image is sent to a third-party model, no processor listing, and no retention statement about the gateway side.

## 8. Account deletion risks

Every foreign key to `auth.users` is `ON DELETE CASCADE`: `profiles`, `people`, `groups`, `group_members`, `expenses`, `expense_items`, `expense_splits`, `item_splits`, `settlements`, `group_invitations`, `activity`. Only `activity.actor_person_id` and `people.linked_profile_id` are `ON DELETE SET NULL`.

Consequence: deleting one auth user **destroys shared financial history for everyone else**. Because `owner_user_id` is the creator, the group creator's deletion cascades the whole group, its members, all expenses anyone can see, and all settlements — silently, in one statement. There is no soft-delete, no anonymization path, no ownership transfer. This is the single highest-severity finding in the audit.

## 9. Native readiness

- **Auth**: Supabase JS with `localStorage` persistence; fine for a WebView/Capacitor shell, needs secure storage for a true native client. Server functions are reachable over HTTPS with a bearer token, so a native client can call them.
- **Apple Sign In**: not implemented (Google only, through the Lovable broker). Required by App Store review once any third-party sign-in exists. Needs provider configuration plus a callback route.
- **Deep links**: `public/.well-known/apple-app-site-association` and `assetlinks.json` already exist and `invite.$token` references an App Store URL — the invitation architecture is already token-based and native-friendly.
- **RPC/RLS**: entirely PostgREST + RPC over HTTPS, so a native client works unchanged.
- **Receipt uploads**: bucket policy is `auth.uid()`-prefixed, which works identically from native.
- **Offline**: the guest `localStorage` store shows the app can run on a local dataset, but there is no sync layer, no per-row `updated_at` on most tables (`expense_splits`, `item_splits`, `group_members`, `settlements`, `activity` have none) and no conflict resolution — offline sync would need those first.
- **Push / biometrics**: nothing exists; both are purely additive later.
- Blocker for a real native client: the browser-side canvas downscale in `parseReceipt.ts` is DOM-dependent (there is a `FileReader` fallback, so it degrades rather than breaks).

## 10. GDPR / privacy observations

EU region is good. Gaps: third-party AI processing is undisclosed; no export ("right to portability"); no deletion path that is both compliant and non-destructive; no retention policy; no consent surface for receipt image processing; server logs are low-risk but unbounded.

## 11. Risks to existing data

The previous incident was caused by revoked `EXECUTE` on `is_group_participant`. Anything touching that function, its grants, or the participant read policies can make groups and balances vanish while `activity` rows survive — exactly the observed symptom. Specific future-work hazards: rewriting `owner_user_id` semantics, replacing rather than adding policies, changing FK delete behavior in place, adding NOT NULL columns to `expenses`/`expense_items`, and any migration that drops and recreates a policy without a verified read-back afterwards.

## 12. Recommended architecture for a private receipt archive

The current schema supports the proposed split cleanly, with one addition rather than a refactor:

```text
receipts (private, owner-only)          expenses (shared)
  id, owner_user_id                       id, group_id, owner_user_id
  storage_path  ──> receipts bucket       title, total, payer, date, currency
  merchant, merchant_raw, address         receipt_id ──> receipts.id (nullable)
  purchase_date, currency, total
  parsed_json (items, discounts)        expense_items (shared, already exists)
  warranty/return metadata later          only the lines the group needs
```

Key points: `receipts` gets owner-only RLS and no participant policy, so sharing an expense never exposes the image; `expenses.receipt_id` is a nullable additive column, so every existing expense stays valid; shared line items keep living in `expense_items`, copied from the receipt at save time rather than joined through it; the image is only ever served via short-lived signed URLs to the owner. The `receipts` bucket and its `auth.uid()`-prefixed policies already match this model exactly.

## 13. Recommendations, ranked

**CRITICAL**

1. Replace `ON DELETE CASCADE` on shared tables with an anonymize-and-retain deletion model (ownership handover or `deleted_user` tombstone). — database migration.
2. Add participant read policies to `settlements`, `activity` and `item_splits` so balances and history are symmetric. — RLS change.
3. Add membership checks to write policies (`expenses`, `group_members`, `settlements`, `activity`) via `is_group_participant`. — RLS change.
4. Lock down `fx_rates` inserts to a server function / service role. — RLS change + backend code.

**SHOULD DO BEFORE RECEIPT ARCHIVE**

5. `receipts` table + `expenses.receipt_id` (additive, nullable). — database migration + RLS.
6. Upload path and signed-URL reads for receipt images; set bucket MIME allow-list and size limit. — backend code + storage change + frontend.
7. Persist the receipt fields currently lost at save (address, raw merchant, receipt discount, per-line discounts). — migration + frontend.
8. Privacy disclosure on the scan screen ("the photo is analysed by an AI provider") and a processor entry. — frontend only.
9. Rate-limit / lengthen `join_code` and consider dropping person names from `get_invitation_preview`. — backend code + migration.

**CAN WAIT UNTIL NATIVE**

10. Apple Sign In. — external service/configuration + frontend.
11. Data export (JSON/CSV) for portability. — backend code + frontend.
12. `updated_at` + soft-delete columns everywhere, as the foundation for offline sync. — migration.
13. Push notifications, biometric unlock, secure token storage. — external service + native.

## 14. Proposed safe implementation order

1. Snapshot counts of groups, members, expenses, splits, settlements, activity per user; keep as a before/after baseline.
2. Ship the additive RLS reads (item 2) alone, verify balances and history for two accounts, then the write-side checks (item 3).
3. Deletion model (item 1) as a pure FK/behavior migration, tested on a throwaway user first — never on live accounts.
4. `receipts` table + `receipt_id` column, additive only, no backfill.
5. Upload + signed URL path behind the existing scan flow, image optional.
6. Persist the extra parsed fields.
7. Privacy copy, then invitation hardening.
8. Native items last.

Rule for every step: `CREATE POLICY` alongside the existing one rather than `DROP`+`CREATE`, no NOT NULL without a default, and a read-back check of one real group's balance after each migration.
