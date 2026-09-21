# Decision log

The PRD states that "ambiguity is part of the test" (§17). This file records every
point where the brief left a choice open, what we chose, and why. It is appended to
as the build progresses.

Each entry names the section of the PRD it resolves, so a reviewer can check our
reading against theirs.

---

## D1 · A player's draw numbers are their golf scores

**PRD §05, §06 — ambiguous.** The brief specifies Stableford scores in the range
1–45, of which the latest five are retained. Separately it specifies a draw that
matches 3, 4 or 5 numbers. It never says where a player's numbers come from.

**Decision.** They are the same five values. A player's retained scores *are*
their entry.

**Why.** Three things point the same way:

- The ranges coincide exactly — five numbers, each 1–45. A 5-from-45 lottery is
  a real format, and the PRD's score bounds match it precisely. That is unlikely
  to be a coincidence in a document this deliberate.
- The alternative — a separate "pick your numbers" step — makes the golf
  tracking decorative. The product would be a lottery with a scorecard attached,
  and the PRD is explicit that it wants one platform, not two features (§01).
- "Algorithmic — weighted by score frequency" (§06) has no coherent meaning
  unless scores and draw numbers share a namespace. You cannot weight a draw by
  score frequency if scores are not the things being drawn.

**Consequence we accept.** Scores repeat — a player can card 32 twice. An entry
is therefore a *multiset*, not a set, and matching counts multiset intersection:
if a player holds {32, 32, 18, 7, 41} and the draw produces {32, 18, 5, 9, 12},
that is two matches, not three. This is handled explicitly in the draw engine
rather than left to `Array.includes`, which would over-count.

**Consequence we like.** Entering a score becomes the emotionally loaded moment
the PRD asks for (§02 EXPERIENCE, §12 FEEL). Every round you play changes your
ticket.

---

## D2 · Money is integers; splits are snapshotted, never recomputed

**PRD §07, §08.1 — unstated.** The brief gives percentages (40/35/25 tier split,
10% charity minimum) but says nothing about representation or rounding.

**Decision.** Every amount is an integer in the currency's minor unit (cents).
Percentages are stored in basis points. The three-way split of each subscription
payment — charity / prize pool / platform — is computed once when the payment is
received and *written to the ledger row*.

**Why.**

- Floating-point money is how a prize pool stops summing to the pool. Splitting
  a tier three ways is a repeating fraction; done in floats, the parts do not
  add back up.
- The inputs to a split are mutable. Users change their charity and raise their
  percentage (§08.1); a plan's prize-pool share can be retuned. Recomputing a
  historical contribution from today's settings would silently restate what a
  charity was owed last March. Storing the split makes every reported total
  reproducible from immutable rows.

**Rounding rule.** The platform share is always computed by subtraction, never
by its own percentage, so the three parts sum to exactly the amount charged
regardless of how the two roundings landed. Where a prize tier does not divide
evenly among its winners, the remainder is carried on the draw as
`undistributedMinor` rather than handed to one arbitrary winner — the PRD
requires prizes "split equally" (§07), and equally means equally.

---

## D3 · The charity percentage is capped at 70%, not 100%

**PRD §08.1 — ambiguous.** Users "may voluntarily increase their charity
percentage." No ceiling is given.

**Decision.** The ceiling is 100% minus the plan's prize-pool share — 70% at the
default 30% pool contribution. The prize pool is taken first; the charity share
comes out of what remains; the platform keeps the rest.

**Why.** An uncapped percentage lets one generous user shrink the prize pool,
which is a promise made to *every* subscriber. A user should be free to give
away the entire platform margin, but not to quietly reduce other people's
winnings. Taking the pool contribution first makes the pool independent of
individual generosity.

---

## D4 · Sessions in the database, not stateless tokens

**PRD §04 VALIDATION — a hard requirement with an implied architecture.**
"Real-time subscription status check on every authenticated request."

**Decision.** Auth uses opaque session tokens stored server-side in Postgres.
The cookie holds a random token; only its SHA-256 hash is stored, so a database
leak cannot be replayed as a login.

**Why.** A JWT asserts what was true when it was minted. A token issued the day
before a payment failed would keep claiming an active subscription until it
expired. "Real-time" in §04 rules that out. Resolving the session against the
database on every request also makes revocation instant, which the admin panel
needs in order to suspend a user meaningfully.

**Cost we accept.** One indexed lookup per authenticated request. At this
platform's scale that is cheap, and it buys correctness on the requirement the
PRD singled out.

---

## D5 · Postgres on Docker locally, Neon in production, one driver

**PRD §15 — names Supabase as an example, not a mandate** ("Backend connected
(e.g. Supabase)").

**Decision.** Plain PostgreSQL, accessed through the standard `node-postgres`
driver, running in Docker for development and on Neon in production.

**Why.** Neon speaks the standard Postgres wire protocol, so the same driver and
the same connection-string format work in both places. Moving between
environments is a change to `DATABASE_URL` and nothing else — there is no
environment-specific branch that only gets exercised in production.

Migrations are generated as SQL files and committed rather than pushed from a
schema diff at deploy time, so a change to a live database can be read before it
runs.

---

## D6 · Constraints in the database where a race could break them

**PRD §05 — a rule stated without an enforcement point.** "Only one score entry
is permitted per date."

**Decision.** Rules that a concurrent request could violate are enforced by the
database: `UNIQUE (user_id, played_on)` for one-score-per-date, `CHECK` for the
1–45 range and the charity percentage bounds.

**Why.** Two browser tabs submitting the same date at the same moment will both
pass an application-level "does this date already exist?" check. Only the
database can decide that race. Application-level validation still runs first —
it produces better error messages — but it is not the thing being relied on.

The one rule that cannot be a constraint is "only the latest 5 scores are
retained; a new score replaces the oldest." That lives in a single transactional
service function, deliberately in one place, so the retained set cannot drift
out of step with the draw entries derived from it.

---

## D7 · Seeded subscriptions carry placeholder Stripe identifiers

**Not in the PRD — a development concern.** Demo data needs active subscriptions
before any real Stripe object exists.

**Decision.** Seeded rows use `sub_seed_…` / `cus_seed_…` identifiers and are
clearly marked as such in the seed script. Only subscriptions created through
Checkout carry real Stripe IDs.

**Why.** An empty platform demonstrates nothing about a draw engine — the seed
needs a population with score histories and several months of payments so the
prize pool has real money in it. The placeholder prefix makes it obvious at a
glance which rows never existed in Stripe, so nobody tries to reconcile them
against a Stripe dashboard.

---

## D8 · Retro screen-print visual language

**PRD §12 — a constraint stated as a negative.** The brief says what the design
must *not* be ("must not resemble a traditional golf website"; avoid "fairways,
plaid, club imagery as primary design language") and asks for "clean, modern,
motion-enhanced" and "emotion-driven — leading with charitable impact, not
sport." It does not say what it should look like.

**Decision.** A 1970s screen-printed sports-poster aesthetic: warm paper stock,
a fixed palette of five saturated flat inks, heavy display type, hard offset
shadows, print grain, and no gradients pretending to be light.

**Why.** The ban is on golf's *house style* — mahogany, manicured turf
photography, crest-and-serif formality — not on colour. A screen-print palette
reads as optimistic, human and charitable, which is what "emotion-driven,
leading with charitable impact" asks for, and it looks nothing like any existing
golf website. It also gives the numbers somewhere to live: draw numbers rendered
as flat-ink balls in a retro monospace are legible at a glance and unmistakably
lottery, which no amount of tasteful minimalism achieves.

**How "professional" is kept.** Discipline, not restraint of colour: one shadow
treatment, one border weight, one type superfamily, a closed palette, and
contrast ratios that pass AA (dark ink on every saturated fill, never white on
orange).

**Light-only, deliberately.** A screen print inverted to dark stops being a
screen print. A half-built dark mode is worse than none, so `color-scheme` is
pinned to light rather than shipping an unconsidered inversion.

---

## D9 · Authorization in the Data Access Layer, not in layouts or proxy

**Next.js 16 architecture — a correctness trap.**

**Decision.** Every authorization check lives in `src/lib/dal.ts`. `proxy.ts`
(Next 16's rename of `middleware.ts`) performs only an optimistic check for the
*presence* of a session cookie, never its validity.

**Why not layouts.** A layout does not re-render when navigating between routes
that share it, and it does not control whether its child segments render —
segments and parallel slots are rendered by the router regardless. A check in a
layout is therefore both skippable and, on navigation, stale.

**Why not proxy.** Proxy runs on every matched request including prefetches, and
may be deployed to the CDN edge separately from the render path. A database
lookup there multiplies load and cannot be relied upon. It exists here purely to
save an unauthenticated visitor a wasted render.

**The division of labour.** A forged cookie gets past `proxy.ts` and is then
rejected by the DAL. That is the design, not a gap: the proxy is an
optimisation, the DAL is the boundary. Because `getCurrentUser()` verifies the
session as a side effect of returning a user, there is no way to read the
current user and forget to check them.

**Also rejected: `forbidden()`.** Next's `forbidden()` is still behind the
experimental `authInterrupts` flag. Admin routes call `notFound()` instead —
stable API, and it does not confirm to a curious subscriber that an admin
surface exists at that URL.

---

## D10 · The two draw modes are a product lever, not a fairness question

**PRD §06 — two options offered without guidance on when to use either.**
"Random — standard lottery-style" and "Algorithmic — weighted by score
frequency."

**Finding.** With a 5-from-45 draw, the chance of any one entry matching three
or more is about **0.64%**. On a small platform that means almost nobody ever
wins: a run with 12 entries in random mode produced zero winners, which is the
statistically expected outcome (≈0.08 expected winners), not a bug.

Algorithmic mode changes this materially. Because a player's numbers are their
Stableford scores, and club Stableford scores cluster in the high twenties to
mid thirties, weighting the draw by score frequency concentrates the drawn
numbers in exactly the band where entries live. The same 12 entries produced a
winner, with drawn numbers 23, 26, 27, 31, 36 — visibly inside the scoring band.

**Decision.** Mode is chosen per draw by an admin, and is recorded on the draw
row rather than being a global setting.

**Why.** The two modes are not "fair" and "unfair" — both are honest, both are
seeded and reproducible. They are different products:

- **Random** gives a genuine lottery: rare, large, jackpot-driven, and it will
  roll over for months on a small member base.
- **Algorithmic** spreads the pool across more, smaller wins, and keeps a young
  platform feeling alive while the member base is still small.

A platform would plausibly launch on algorithmic and move to random as it grows.
Baking either into the code would have removed that choice, so the mode is data,
selectable at simulation time and shown publicly on every published result.

**Not hidden.** Each published draw states which logic produced it, alongside
its seed, so the choice is disclosed rather than being an invisible thumb on the
scale.

---

## D11 · One pool calculation, used everywhere

**A bug found by cross-checking pages, not by a test.**

The homepage and the results page each computed "this month's prize pool" and
disagreed: the homepage summed the ledger for the period (€200.85) while the
results page used the draw service, which also adds the unclaimed jackpot
carried in (€221.25).

**Decision.** `calculatePool()` in the draw service is the single source of
truth, and the marketing statistics now call it rather than re-deriving the
figure with their own query.

**Why it mattered.** The number quoted on the page that persuades someone to
subscribe has to be the number the draw will actually pay out. Two independent
implementations of the same business rule will drift, and the one on the
marketing page is the one people will screenshot.

---

## D12 · Checkout reconciles on return AND on webhook

**PRD §04 LIFECYCLE — "handles renewal, cancellation, and lapsed-subscription
states."**

**Decision.** The Checkout return page reconciles the session server-side before
rendering, and the webhook handles everything afterwards. Both call the same
`syncSubscriptionFromStripe`.

**Why both.** Relying on the webhook alone means the user lands back from
Stripe on a page that still says "no subscription" until the event arrives —
seconds, on a cold serverless function. That looks broken, and a user who
believes their payment failed may pay twice. Reconciling on return makes the
first payment instant.

Relying on the return alone is worse: it only ever fires once, so renewals,
failed payments, and cancellations made in Stripe's own portal would never
reach us.

**Why one shared function.** Two code paths writing the same rows would drift,
and the one that ran less often would be the buggy one. Both are idempotent —
the upsert targets the unique index on `stripe_subscription_id`, and the ledger
insert targets the unique index on `stripe_invoice_id`, so a webhook redelivery
cannot double-count money into the prize pool.

**Webhook safety.** Signatures are verified against the raw request body before
anything is acted on; an unverified payload is an unauthenticated request
claiming to be Stripe. `/api` is excluded from the proxy matcher, because a
redirect would read to Stripe as a delivery failure and trigger retries of an
event that was never processed. A handler that throws returns 500 deliberately,
so Stripe retries — losing a renewal silently is far worse than processing one
twice.

---

## D13 · Navigation: one bar, unambiguous labels

**Found by using the app, not by reading the code.**

The dashboard rendered the site header and a section tab bar as two stacked
full-width bars. Beyond looking like two headers, the labels collided: the site
header's "Draws" links to public results while the tab's "Draws" linked to the
player's own history — the same word pointing at two different pages. "Charities"
and "Charity" had the same problem.

**Decision.** One sticky bar. Section navigation is inline pills inside the
content column, and the player's own sections are possessive: "My scores", "My
draws", "My charity".

Separately, `/pricing` existed and worked but was reachable only from the
footer, and no header link indicated the current page. Pricing is now in the
primary nav, and both navs mark the active route with `aria-current="page"` —
which also fixes the accessibility gap, since previously nothing announced where
you were.

**Rule taken from this.** A route that exists but is not linked does not exist
to a user. Link coverage is now checked against the route list rather than
assumed.

---

## D14 · Proof screenshots stored in Postgres, served through an authorised route

**PRD §09 PROOF UPLOAD — "Screenshot of scores from the golf platform."** The
brief says nothing about where the file lives.

**Decision.** Files are stored as `bytea` in a dedicated `uploads` table and
served by `/api/uploads/[id]`, which authorises every request against the
session. There is no public URL and no signed link.

**Why not object storage.** The usual answer is a bucket, and at volume it is
the right one. These files are not that: only winners upload, a capped
screenshot is small, and the content is a named person's scorecard attached to a
payout claim — private by default. Postgres gives no second service to
provision, identical behaviour on local Docker and Neon, and access control
that is a `WHERE` clause rather than a presigned-URL scheme that has to be got
right. The bytes live in their own table so listing verifications never drags
image data through a query, which is also the seam to move to a bucket later:
the serving route is the only thing that reads `data`.

**The real risk, and how it is closed.** The dangerous part of accepting files
is not storage, it is *serving them back*. `File.type` is supplied by the
client, so an HTML document labelled `image/png` would be stored and later
served as HTML — executing script in our own origin, with the victim's session.

So the content type is derived from the file's own magic bytes, never the
claim; only PNG, JPEG and WebP are accepted; and SVG is refused outright because
it is simultaneously a legitimate image and an XML document that can carry
`<script>`. Responses add `X-Content-Type-Options: nosniff` and a
`default-src 'none'; sandbox` CSP so that even a mistake in that logic cannot
execute. Filenames are stripped of CRLF, quotes and path separators before being
echoed into `Content-Disposition`.

**Verified, not assumed.** `npm run verify:uploads` asserts the disguised-file
cases directly — HTML-as-PNG, SVG, PDF-as-PNG, truncated headers, oversized
files, and header-injection filenames. Route authorisation is checked live:
anonymous, a different signed-in user, and a malformed id all receive 404 (not
403 — confirming an id exists would leak that someone made a claim), while the
owner and an administrator receive 200.

---

## D15 · The build must not need a database

**Found when the build ran with Postgres down.** `next build` tried to
prerender `/draws` and failed on a database query.

Pages that read the database *before* touching a request API (cookies,
headers, search params) are candidates for build-time prerendering. With the
database up this failed silently in the worse direction — it would have baked
that moment's prize pool into static HTML. With it down, the build broke.

**Decision.** Public pages that show live figures (`/`, `/draws`, `/pricing`)
call Next 16's `await connection()` before any query, which marks them as
request-time only. It is placed in the pages rather than the shared data layer,
because the CLI scripts (`demo:draw`, `verify:*`) call the same service
functions outside any request, where `connection()` cannot be used.

**Verified** by building with Docker stopped: the build succeeds and every data
route is reported as dynamic. This is what makes the Vercel build independent
of whether Neon is reachable from the build machine.

---

## D16 · Donations are a separate ledger, by construction

**PRD §08.1 — "Independent donation option, not tied to gameplay."**

**Decision.** One-off gifts use a Stripe Checkout session in `payment` mode,
tagged `kind=donation`, and are recorded only in the `donations` table. They
never write to `payments`, so they can never enter the prize-pool calculation.
Visitors can give without an account; a signed-in donor's gift is linked to
their profile.

**Why a separate table rather than a flag on payments.** The prize pool is a
`SUM` over the payments ledger. A flag would make correctness depend on every
future query remembering to exclude donations; a separate table makes the wrong
answer impossible to write.

**Verified.** `npm run verify:donations` creates a real Stripe session, settles
it twice (the second is a no-op), and asserts the payments ledger row count and
the current prize pool are unchanged before and after.

---

## D17 · Yearly subscriptions fund all twelve monthly pools

**PRD §07 — "Auto-calculation of each pool tier based on active subscriber
count."**

**Found on re-reading the PRD against live data.** Five yearly subscribers had
paid €149.85 into the prize pool, and all of it landed in the single month they
paid. They are entered in *every* monthly draw for a year, so they funded one
draw and rode free in the other eleven — that month's pool was inflated about
3.8×, and the following months were funded by monthly subscribers alone.

**Decision.** `calculatePool` spreads each yearly payment's prize-pool slice
across the twelve periods it covers, using exact integer division: the floor
share every month, plus one cent in the first `total mod 12` months. The ledger
row is unchanged — the payment still happened when it happened — only the
allocation to draws is spread.

**Verified.** Twelve slices sum exactly to the whole for every amount tested
(`verify:draw`). On the seeded data, €149.85 now funds €12.50 a month for nine
months and €12.45 for three: 9 × 12.50 + 3 × 12.45 = 149.85. Published draws
are snapshots and are not affected retroactively.

---

## D18 · Restricted access for non-subscribers, enforced in the action

**PRD §04 — "Non-subscribers receive restricted access to platform features."**
§03 lists entering and editing scores as a *subscriber* capability.

**Found on re-reading the PRD.** `requireSubscriber()` existed but was never
called: anyone signed in could log scores. Only draw entry excluded them.

**Decision.** Score mutations check the live subscription inside the server
action — hiding the form alone would not be a control, because the action can
be called without it. A lapsed member still *sees* their scores (they are the
member's own history) and still sees and can claim past winnings, but cannot
change scores until they resubscribe. The dashboard and scores page no longer
tell a lapsed member with five scores that they are "entered", because the draw
engine only locks in active subscribers.

---

## D19 · Money totals come from one module

**Found by auditing, not by a failing test.** "Raised" was calculated
independently in eight places. Only the charity profile included one-off
donations, and two of the eight did not filter by payment status at all — a
failed card charge counted as money given.

**Decision.** `src/lib/giving.ts` is the only definition of raised and given.
Pages call it or embed its SQL fragment; none sums the ledger themselves. The
admin overview's split bars are the one deliberate exception: they check the
subscription-ledger invariant (charity + pool + platform = gross), which
donations are kept out of by design (D16).
