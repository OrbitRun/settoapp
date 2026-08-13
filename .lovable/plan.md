# PARI — first foundation build

Mobile-first shared expenses app: calm, premium, Scandinavian. Simple by default, powerful when needed.

## Scope of this build

Full front-end product with a real financial engine and realistic demo data, running entirely in-app state (no login wall, instant to demo). The data model is shaped exactly like the proposed relational schema so a backend can be attached later without rewriting screens.

Recommendation: keep the backend out of build #1. Auth + RLS would add a sign-up wall in front of a product whose whole point is that people don't need accounts. Once the flows feel right, we wire the same model to Lovable Cloud.

## Design system

- Warm off-white `#F7F6F2`, deep forest `#062D24`, dark bg `#071C19`, muted mint accent `#78D8BC`, subtle warm greys. Restrained semantics: owed = forest/mint, owe = muted clay, never alarm red.
- Typography-led hierarchy: large confident balance numbers, medium headings, quiet secondary text. Minimal borders, generous whitespace, refined radii.
- Everything as design tokens in `src/styles.css`; no hardcoded colors in components.
- Mobile-first: content constrained to a phone-width column, elegantly centered with breathing room on desktop. Never an admin dashboard.

## Navigation

Bottom bar: Home — Groups — [Split] — Activity. Split is the visually prominent centre action opening a bottom sheet. Profile/settings sits behind a small avatar in the top area.

## Screens

1. Home — greeting, big "You're owed" number, active groups, recent expenses.
2. Groups — scannable list with initials, personal balance, quiet Create group action.
3. Group detail — your balance first, then Expenses / People / Rules tabs, Add expense.
4. Create group — name, people by name only, optional secondary Default split.
5. Split launcher — bottom sheet: Scan receipt, Add amount, small Multiple receipts.
6. Manual expense — large amount input, title, Paid by, participant pills with Select all, live per-person result, subtle "Split equally ▾" opening Equal / Percentage / Shares / Exact. Group defaults auto-apply with "Using group split · 60/40 · Change".
7. Receipt scan — camera/upload, calm "Scanning receipt…" state, mock parsed result.
8. Receipt review — editable items (rename, price, quantity, delete), items total vs receipt total with gentle "Looks good" / "We're missing 28 DKK".
9. Receipt split — equal split confirmable in one tap; "Split by item" as secondary.
10. Item splitting — per-item participant chips, multi-select items with a "3 items selected → Assign people" action bar, Private / Don't split, and "Share selected → pick group" for the supermarket case.
11. Split result — Done, per-person breakdown, Save to group / Share result, discreet "Save these people as a group?".
12. Activity — calm chronological feed grouped by day.
13. Settle up — simplified payment directions from net balances, Copy amount / Mark as paid.

Plus a 3-screen minimal onboarding and thoughtful typographic empty states.

## Financial engine

Pure, testable functions in integer minor units (øre): `calculateEqualSplit`, `calculatePercentageSplit`, `calculateShareSplit`, `calculateExactSplit`, `allocateRoundingDifference`, `calculateBalances`, `calculateSettlementPlan`. Balances derive from paid minus share, never stored as "X owes Y". Allocations always sum exactly to the total. Unit tests cover the rounding and the five scenarios in the brief.

## Reusable primitives

Avatar, PersonChip, MoneyAmount, BalanceDisplay, GroupRow, ExpenseRow, SplitSelector, PercentageSplitEditor, ReceiptItem, ParticipantSelector, BottomSheet, PrimaryButton, SecondaryButton, EmptyState, ActivityRow. No split math inside components.

## Technical notes

- TanStack Start routes: `/`, `/groups`, `/groups/$groupId`, `/groups/new`, `/split/*` (manual, scan, review, item-split, result), `/activity`, `/settle/$groupId`, `/onboarding`, `/profile`.
- Typed domain model mirroring profiles, people, groups, group_members, expenses, expense_items, expense_splits, item_splits, settlements, activity — held in a store so a Supabase swap is a data-layer change only.
- Motion for subtle sheet/slide transitions and animated numbers; no bounce, confetti or gamification.
- Demo data exactly as specified: Peter as current user, Bofællesskabet (+428), Anna & Peter (60/40), Sommerhus 2026 (+620), Netto / Shell / Firewood / Restaurant.
- Lucide line icons only, one consistent weight.
