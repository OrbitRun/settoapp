# Safe security fix 3 — lock down FX rate writes

## What the pre-flight found

- `public.fx_rates` holds 3 cached rows (base/quote/date/rate/source).
- Policies today: `authenticated can read fx rates` (SELECT, `using true`) and `authenticated can cache fx rates` (INSERT, `check true`). No UPDATE/DELETE policies exist.
- Table privileges are currently wide: `anon`, `authenticated` and `service_role` all hold SELECT, INSERT, UPDATE and DELETE.
- Only two code paths touch the table, both in `src/lib/fx.server.ts` (`readCachedRate`, `writeCachedRate`), and both use the service-role admin client loaded inside the handler.
- Those helpers are called only from the `getExchangeRate` server function (`src/lib/fx.functions.ts`), which the browser reaches through `useExchangeRate` → `useMoneyLock`. No client component queries `fx_rates` directly.

Conclusion: the cache write already runs through trusted server-side code with the service role. The authenticated INSERT policy is unused by the app but does let any signed-in client write arbitrary rates. The issue is confirmed, and removing client write access does not break the FX flow.

## The change

One migration, no code changes:

- Drop the `authenticated can cache fx rates` INSERT policy.
- Revoke INSERT, UPDATE and DELETE on `public.fx_rates` from `anon` and `authenticated`; revoke all privileges from `anon` since nothing anonymous reads rates.
- Keep SELECT for `authenticated` (policy and grant untouched) so any future read-only use keeps working.
- Keep `GRANT ALL` for `service_role`, which is what the server function uses.

Existing rows, historical expense rates, and the ECB/Frankfurter fetch logic stay exactly as they are.

## Verification

- Conversion through the app for a foreign-currency draft (e.g. EUR → DKK) returns the correct rate and still caches.
- As a normal authenticated client: INSERT, UPDATE and DELETE against `fx_rates` are all rejected.
- A fresh uncached date/pair is fetched and written by the server function successfully.
- Regression check that groups, members, expenses, settlements, activity counts and balances are unchanged.

## Out of scope

No changes to `is_group_participant`, group/member policies, expenses, splits, settlements, activity, invitations, receipts, storage or account deletion. No service credentials move toward the browser.
