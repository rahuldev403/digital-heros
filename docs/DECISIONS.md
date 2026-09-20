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
