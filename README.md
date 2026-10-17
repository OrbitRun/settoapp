# Setto

Build PARI — Mobile-first shared expenses fintech app

Build the first production-quality foundation for a mobile-first fintech application called PARI.

PARI helps people manage and split shared expenses in an extremely simple way.

It must work for:

splitting a restaurant bill

couples without fully shared finances

couples using percentage-based splits such as 60/40

roommates

shared households

holidays and weekend trips

groups of friends

individual supermarket items that need to be shared while the rest of the receipt remains private

multiple expenses accumulated over time

The core product philosophy is:

Simple by default. Powerful when needed.

A basic split should take only seconds.

Advanced functionality must never make a simple split feel complicated.

The product should feel like a premium consumer fintech product, not accounting software and not a spreadsheet.



IMPORTANT PRODUCT PRINCIPLE

Do not expose complexity unless the user asks for it.

For example:

If a user enters 1,000 DKK and selects four people, the default experience should simply show:

250 DKK each

Do not ask the user about percentages, custom shares, itemized splitting or advanced settings unless they actively choose them.

Use progressive disclosure throughout the product.



VISUAL DIRECTION

The visual design is extremely important.

PARI should feel:

modern

minimalist

premium

Scandinavian

high-end fintech

calm

trustworthy

human

highly polished

Think in terms of the refinement level of premium modern fintech and consumer apps, but do not directly copy any existing product.

Do NOT make PARI look like:

bookkeeping software

an expense spreadsheet

a generic SaaS dashboard

a crypto app

a banking portal

a colorful gamified finance app

Avoid:

excessive gradients

excessive borders

dense layouts

tiny text

unnecessary cards inside cards

giant shadows

generic illustrations

cartoon aesthetics

cheap-looking fintech iconography

dollar signs

coins

credit-card imagery

pie charts on the home screen

Use generous whitespace.

Use typography and hierarchy instead of borders wherever possible.



DESIGN SYSTEM

Create a reusable design system.

Use a warm off-white background for light mode rather than pure white.

Suggested direction:

Background:
#F7F6F2

Primary dark:
deep forest / near-black green

Suggested:
#062D24

Dark-mode background:
#071C19

Accent:
muted premium mint

Suggested:
#78D8BC

Neutral surfaces:
very subtle warm greys.

Negative balances should not automatically use aggressive red everywhere. Use restrained semantic colors.

Typography should be clean and highly readable.

Use a modern sans-serif with an iOS-like feel.

Typography hierarchy should use:

large confident balance numbers

clear medium-weight headings

subtle secondary information

minimal uppercase text

Use rounded corners, but keep them refined.

Avoid making every element a rounded card.

Spacing should feel generous and intentional.



MOBILE FIRST

Design primarily for iPhone.

The application should feel almost native on mobile.

Target approximately:

iPhone 15 / 16 sized screens

comfortable thumb interaction

bottom navigation

large tap targets

sheets and bottom sheets where appropriate

smooth mobile transitions

Desktop/web responsiveness can exist, but mobile UX takes priority.

On desktop, center the mobile product experience or adapt it elegantly rather than turning it into a traditional admin dashboard.



MAIN NAVIGATION

Create four primary navigation destinations:

Home

Groups

Split

Activity

The Split action is the primary action in the entire application.

Make it visually prominent in the center area of the bottom navigation.

Conceptually:

Home — Groups — [+ SPLIT] — Activity

Split should feel like the obvious action a user taps when opening the app to add or divide an expense.

Profile/settings should NOT take a permanent bottom-navigation position.

Place profile/settings behind a small avatar or profile control in the upper part of the interface.



CORE INFORMATION ARCHITECTURE

PARI consists of:

Users

Registered users.

People

People who can participate in expenses.

A person must not necessarily have a registered PARI account.

This is important.

A user should be able to create:

Peter
Emma
Mads
Sofie

without forcing those people to sign up first.

Later they may claim or connect their profile.

Groups

Examples:

Anna & Peter

Bofællesskabet

Sommerhus 2026

Skiferie

Festival

Expenses

An expense represents something paid by one person.

Examples:

Netto — 486 DKK

Shell — 612 DKK

Dinner — 1,248 DKK

Rent — 12,000 DKK

Expense items

Optional individual items belonging to an expense.

Examples:

Toilet paper — 42 DKK

Beer — 60 DKK

Burger — 159 DKK

Splits

The financial allocation determining which people are responsible for which amount.

Settlements

Payments between people used to settle balances.



BUILD THESE CORE SCREENS

Create polished, realistic versions of the following screens.

Use realistic demo data so the product feels alive immediately.



SCREEN 1 — HOME

The Home screen is a personal overview.

Do NOT make it an analytics dashboard.

At the top:

Small friendly greeting.

Example:

Good evening, Peter

Then show the most important number:

You’re owed

1,248 DKK

Use large premium typography.

Below, show active groups.

Example:

Bofællesskabet

You are owed
428 DKK

Sommerhus 2026

You are owed
620 DKK

Anna & Peter

You owe
200 DKK

Use a restrained list/card hybrid.

Do not make every group an oversized rectangle.

Below this show:

Recent

Examples:

Netto
486 DKK
Paid by Peter

Shell
612 DKK
Paid by Mads

Keep the page extremely clean.



SCREEN 2 — GROUPS

Create a Groups overview.

Groups should be easy to scan visually.

Example groups:

Bofællesskabet

Anna & Peter

Sommerhus 2026

Skiferie

Each group should show:

group name

small member avatars/initials

personal balance

subtle status

Example:

Bofællesskabet

4 members

+428 DKK

Do not overload the card with statistics.

Include:

Create group

as a clean secondary action.



SCREEN 3 — GROUP DETAIL

Opening a group should prioritize the user’s own financial position.

Example:

Sommerhus 2026

6 members

Then:

Your balance

+620 DKK

You should receive money

Under this, create a segmented navigation or tabs:

Expenses

People

Rules

Default to Expenses.

Show recent expenses:

Netto — 1,248 DKK

Shell — 612 DKK

Firewood — 250 DKK

Restaurant — 2,180 DKK

Each should show:

merchant/title

date

who paid

amount

Include a clear:

+ Add expense

action.



SCREEN 4 — CREATE GROUP

Keep this extremely simple.

Fields:

Group name

Example:
Sommerhus 2026

Then:

People

Allow users to add people by name.

Do not require email addresses.

Example chips/list:

Peter

Emma

Sofie

Mads

Include:

Add person

Then an optional section:

Default split

Default:

Equal

Other available options:

Equal

Percentage

Custom

But make this optional and visually secondary.

Allow:

Create group

without configuring advanced rules.



SCREEN 5 — SPLIT LAUNCHER

This screen is extremely important.

When the user taps the central Split button, present a premium bottom sheet or dedicated action screen.

The primary choices should be:

Scan receipt

Use camera or upload a receipt.

Add amount

Enter an expense manually.

Optionally include a smaller tertiary action:

Multiple receipts

Do not display ten actions.

Keep the decision extremely simple.



SCREEN 6 — MANUAL EXPENSE

Create the manual expense flow.

Large currency input:

0 DKK

Allow title:

Example:
Fuel

Then:

Paid by

Default to current user.

Then:

Who shares this?

Show people as selectable chips or avatar pills.

Include:

Select all

Default split:

Equal

Show the result immediately.

Example:

Expense:

600 DKK

People:

Peter
Emma
Mads

Display:

200 DKK each

Do not make the user press Calculate.

The interface should always update live.



ADVANCED SPLIT OPTIONS

From the manual expense screen, include a subtle control:

Split equally ▾

Opening it presents:

Equal

Percentage

Shares

Exact amounts

This must be optional.

Do not make this advanced menu prominent.



PERCENTAGE SPLIT

Create an elegant percentage editor.

Example:

Peter

60%

Anna

40%

Always show the monetary consequence.

Example:

1,000 DKK

Peter
60%
600 DKK

Anna
40%
400 DKK

Validate that percentages total 100%.

Provide a subtle progress indicator if useful.



GROUP DEFAULT SPLIT

A group may have a default rule.

Example:

Group:

Anna & Peter

Default:

Peter — 60%

Anna — 40%

When an expense is added to this group, automatically apply the group default.

The user should see:

Using group split · 60/40

with a small:

Change

action.

Do not force the user to configure the split every time.



SCREEN 7 — RECEIPT SCAN PLACEHOLDER

For this first implementation, build the complete receipt-scan UI and state flow, but use mock parsed receipt data.

We will connect real OCR/AI later.

Flow:

Tap:

Scan receipt

Then show a camera/upload screen.

After simulated processing show:

Receipt found

Merchant:

Netto

Total:

486.00 DKK

Detected items:

Bananas
24 DKK

Chicken
65 DKK

Toilet paper
42 DKK

Protein shake
28 DKK

Dishwasher tablets
55 DKK

Olive oil
82 DKK

etc.

Include a visual state:

Scanning receipt…

Keep it premium and calm.

Avoid gimmicky AI animations.



SCREEN 8 — RECEIPT REVIEW

After receipt parsing, show:

Merchant

Date

Total

Then the detected items.

Every item should be editable.

The user must be able to:

rename item

change price

change quantity

delete item

At the bottom show:

Detected items total

and

Receipt total

If they match:

Show a subtle:

✓ Looks good

If they do not match:

Show:

We’re missing 28 DKK

Do not use scary error UI.

This is a validation aid.



SCREEN 9 — RECEIPT SPLIT

This is one of PARI’s defining screens.

At the top show:

How should this receipt be shared?

Primary default:

Split equally

Example:

486 DKK

4 people

121.50 DKK each

Large primary button:

Confirm split

Secondary action:

Split by item

This is critical.

Users who want equal splitting should be able to finish immediately.

Do not force them into item selection.



SCREEN 10 — ITEM SPLITTING

When the user selects:

Split by item

show the receipt items.

Example:

Toilet paper

42 DKK

Below show participant chips:

Peter
Emma
Mads
Sofie

Allow multiple selection.

If all are selected, show:

10.50 DKK each

Example:

Protein shake

28 DKK

Peter selected.

Show:

Peter · 28 DKK

Make this interaction extremely fast.



MULTI-SELECT ITEMS

This is a required UX feature.

Users must be able to select multiple receipt items.

Example:

✓ Toilet paper

✓ Dishwasher tablets

✓ Cleaning spray

Then display a bottom action bar:

3 items selected

Assign people

Opening this allows:

Peter
Emma
Mads
Sofie

Then apply the same split to all selected items.

This is especially important for supermarket receipts.



PERSONAL ITEMS

Users need to be able to exclude receipt items from a group split.

Provide a simple action such as:

Private

or:

Don’t split

Example:

Protein shake — 28 DKK

Set as:

Private

This item must not affect the shared expense.



USE CASE TO SUPPORT

Example supermarket receipt:

Total:

486 DKK

Shared:

Toilet paper — 42

Dishwasher tablets — 55

Everything else is private.

The user should be able to select those two items and tap:

Share selected

Then select:

Bofællesskabet

Result:

97 DKK shared

The remaining receipt stays private.

Design this flow into the UX.



SCREEN 11 — SPLIT RESULT

After completing a split show a clean confirmation screen.

Example:

Done

Restaurant

1,248 DKK

Peter
428 DKK

Mads
312 DKK

Sofie
284 DKK

Emma
224 DKK

Below:

Save to group

Share result

If this split was created without a group, discreetly suggest:

Save these people as a group?

Do not interrupt the primary completion flow.



SCREEN 12 — ACTIVITY

Create a chronological activity feed.

Examples:

Today

Peter added
Netto · 486 DKK

Mads added
Fuel · 612 DKK

Sofie changed the split
Restaurant · 2,180 DKK

Emma marked payment as settled
427 DKK

The feed should feel transparent and calm, not social-media-like.



SCREEN 13 — SETTLEMENT

Create a settlement screen for a group.

Example:

Settle up

PARI calculates simplified payment directions.

Example:

Mads pays Peter

427.50 DKK

Emma pays Sofie

184.25 DKK

Include actions:

Copy amount

Mark as paid

Do not integrate actual payments yet.

Settlement should be calculated from net balances rather than creating unnecessary pairwise debts.



BALANCE LOGIC

The financial model must be based on:

Amount paid minus responsible share

Example:

Peter pays:

1,000 DKK

Peter’s share:

600 DKK

Anna’s share:

400 DKK

Then:

Peter balance:

+400 DKK

Anna balance:

−400 DKK

Do not store only:

“Anna owes Peter 400”

Store the underlying expense and allocations so balances can be recalculated.



ROUNDING

Financial calculations must operate in minor currency units whenever possible.

For DKK use øre as integer values internally.

Example:

100 DKK split among 3 people should become:

33.34

33.33

33.33

Total must always equal exactly:

100.00 DKK

Never allow floating-point rounding errors to cause totals not to match.

Create reusable financial helper functions.



DATABASE MODEL

Prepare a clean relational database structure.

Use Supabase if available.

Suggested tables:

profiles

id

display_name

avatar_url

created_at

people

Represents a financial participant.

id

owner_user_id nullable

linked_profile_id nullable

name

avatar_url nullable

created_at

groups

id

name

created_by

default_split_type

currency

created_at

archived_at nullable

group_members

id

group_id

person_id

role

default_weight nullable

default_percentage nullable

joined_at

expenses

id

group_id nullable

created_by

paid_by_person_id

title

merchant nullable

expense_date

currency

total_minor

source_type

receipt_image_url nullable

created_at

updated_at

source_type examples:

manual
receipt

expense_items

id

expense_id

name

quantity

unit_price_minor

total_minor

category nullable

is_shared

created_at

expense_splits

Use this for whole-expense allocations when item-level splitting is not needed.

id

expense_id

person_id

amount_minor

percentage nullable

shares nullable

item_splits

id

expense_item_id

person_id

amount_minor

percentage nullable

shares nullable

settlements

id

group_id

from_person_id

to_person_id

amount_minor

currency

status

settled_at nullable

created_at

activity

id

group_id nullable

actor_profile_id

activity_type

entity_type

entity_id

metadata

created_at



SECURITY

If using Supabase:

Prepare sensible Row Level Security.

Users should only be able to access:

groups they belong to

expenses belonging to their groups

their own profile

people/groups they created where applicable

Do not disable RLS simply to make development easier.

Structure policies cleanly.



DEMO DATA

Populate the app with realistic sample data so every screen feels complete.

Current user:

Peter

Groups:

Bofællesskabet

Peter
Mads
Sofie
Emma

Peter balance:
+428 DKK

Anna & Peter

Peter
Anna

Default split:

Peter 60%

Anna 40%

Sommerhus 2026

Peter
Mads
Sofie
Emma
Jonas
Marie

Peter balance:
+620 DKK

Expenses:

Netto — 1,248 DKK

Shell — 612 DKK

Firewood — 250 DKK

Restaurant — 2,180 DKK

Use this data consistently across screens.



INTERACTIONS

Use smooth subtle transitions.

Prefer:

bottom sheets

subtle slide transitions

animated number changes

selection feedback

lightweight skeleton states

Avoid:

bouncing animations

flashy gradients

unnecessary confetti

gamification

The app handles money.

It should feel calm and trustworthy.



ICONS

Use a consistent minimalist icon library.

Prefer simple thin/medium line icons.

Do not use emoji as permanent UI icons.

Avoid mixing icon styles.



EMPTY STATES

Design thoughtful empty states.

Example new user:

No shared expenses yet

Split your first expense in seconds.

[ Split an expense ]

Avoid illustrations unless extremely subtle.

Typography alone is acceptable.



COPY STYLE

PARI should sound:

simple

confident

friendly

calm

Avoid finance jargon.

Avoid technical language.

Instead of:

Create expense allocation

say:

Who shares this?

Instead of:

Settlement transaction

say:

Settle up

Instead of:

Debtor

say:

You owe

Instead of:

Creditor

say:

You’re owed

Use short sentences.



FIRST-RUN ONBOARDING

Keep onboarding minimal.

Maximum 3 concise screens.

Suggested:

Screen 1

Share anything.

Dinner, rent, groceries or a weekend away.

Screen 2

Split it your way.

Equal, 60/40 or down to individual items.

Screen 3

Settle easily.

PARI keeps track of who owes what.

CTA:

Get started

Do not require group creation during onboarding.



RESPONSIVE WEB VERSION

The product is primarily mobile.

For wider browser screens:

center content elegantly

use additional whitespace

constrain reading width

optionally show contextual side information

Do NOT transform the interface into a desktop admin dashboard.

The product should retain its consumer-app character.



ARCHITECTURE

Use reusable components.

Create reusable primitives for:

PersonChip

Avatar

MoneyAmount

BalanceDisplay

GroupRow

ExpenseRow

SplitSelector

PercentageSplitEditor

ReceiptItem

ParticipantSelector

BottomSheet

PrimaryButton

SecondaryButton

EmptyState

ActivityRow

Keep financial calculations in dedicated utility functions or services.

Do not duplicate split calculations inside UI components.



FINANCIAL ENGINE

Implement clean functions conceptually equivalent to:

calculateEqualSplit()

calculatePercentageSplit()

calculateShareSplit()

calculateExactSplit()

calculateBalances()

calculateSettlementPlan()

allocateRoundingDifference()

These functions should be independently reusable and testable.



CURRENT SCOPE

For this first build:

DO build:

visual design system

mobile navigation

Home

Groups

Group detail

Create group

Manual expense

Equal split

Percentage split

receipt scan mock flow

receipt review

item-level splitting

multi-item assignment

personal/private items

Activity

Settlement

Supabase-compatible data model

realistic demo state

DO NOT yet build:

real AI receipt parsing

OpenAI integration

MobilePay integration

bank integrations

payment processing

subscriptions

multi-currency conversion

social feeds

complicated analytics

budgeting tools

recurring expenses

push notifications

Build the foundation correctly first.



QUALITY REQUIREMENT

Do not treat this as a quick prototype.

The result should feel like the beginning of a real premium fintech product.

Prioritize:

UX clarity

visual polish

mobile ergonomics

financial correctness

reusable architecture

speed

Do not add features that were not requested simply to fill space.

If there is a choice between showing more information and making the interface calmer, prefer the calmer interface.



MOST IMPORTANT USER EXPERIENCE

The most important flow to get right is:

Split → Scan receipt → Confirm receipt → Choose people → Split equally OR split by item → Result

The second most important flow is:

Group → Add expense → Enter amount → Use group’s default split → Save

The third most important flow is:

Supermarket receipt → select only shared items → assign group → save shared amount

These three flows should feel exceptionally polished.



FINAL PRODUCT TEST

Before considering the first build complete, verify that these scenarios work conceptually and visually:

Scenario 1 — Restaurant

Peter scans a 1,200 DKK bill.

Four people attended.

He selects all four.

PARI shows:

300 DKK each.

He can finish immediately.

Scenario 2 — Restaurant by item

Peter scans a restaurant receipt.

Peter had burger + beer.

Sofie had pasta.

Mads and Emma shared wine.

Each item can be assigned correctly and totals always match the receipt.

Scenario 3 — Roommates

Peter scans a 486 DKK supermarket receipt.

Only:

42 DKK toilet paper

and

55 DKK dishwasher tablets

should be shared.

He selects those items and assigns them to Bofællesskabet.

PARI creates a 97 DKK shared expense.

Scenario 4 — Couple

Anna and Peter have a group using:

Peter 60%

Anna 40%

Peter pays a 1,000 DKK electricity bill.

PARI automatically assigns:

Peter 600 DKK

Anna 400 DKK

and Peter’s balance increases by 400 DKK.

Scenario 5 — Holiday

Six friends have multiple expenses over several days.

PARI keeps one running balance per person.

At the end, PARI proposes a simplified settlement plan.



Build this first foundation with exceptional attention to detail.

Do not redesign the product concept.

Do not introduce unnecessary complexity.

PARI should feel simple even when the financial logic underneath is powerful.

Share anything. Settle easily.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://settoapp.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b264465b-d7f6-467b-aa75-b263da17814c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
