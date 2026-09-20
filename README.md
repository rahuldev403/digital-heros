# Digital Heroes

A subscription platform where your golf scores are your lottery numbers, and part of every subscription goes to a charity you choose.

Built against the Digital Heroes PRD (Level 1) — see [`docs/`](docs/).

---

## Quick start

**Prerequisites:** Node 20+, Docker Desktop, and (from Phase 2) a Stripe test account.

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
#    Then generate a session secret and paste it into AUTH_SECRET:
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"

# 3. Start Postgres (Docker)
npm run db:up

# 4. Create the schema and load demo data
npm run db:setup

# 5. Run the app
npm run dev
```

Open <http://localhost:3000>.

### Demo credentials

Created by `npm run db:seed`. Configurable via `SEED_*` variables in `.env.local`.

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@digitalheroes.test` | `Admin@12345` |
| Subscriber | `player@digitalheroes.test` | `Player@12345` |

---

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm run db:up` / `db:down` | Start / stop the local Postgres container |
| `npm run db:reset` | Destroy the local database and start a fresh one |
| `npm run db:generate` | Generate a SQL migration from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Truncate and reload demo data |
| `npm run db:setup` | `db:migrate` + `db:seed` |
| `npm run db:studio` | Drizzle Studio, a browser DB client |
| `npm run stripe:doctor` | Report the connected Stripe account's country, currency and products |
| `npm run verify:draw` | Run the draw-engine property checks |
| `npm run demo:draw` | Run and publish a draw for a past period (additive, non-destructive) |
| `npm run dev:session` | Mint a session cookie for a seeded account (local DB only) |
| `npm run stripe:sync` | Create/update Stripe products and prices from the plans table |
| `npm run verify:checkout` | Create real Checkout sessions and assert price, currency and metadata |
| `npm run verify:uploads` | Assert upload validation rejects disguised and oversized files |

A web DB browser is also available at <http://localhost:8080> while the container runs
(server `postgres`, user `dh`, password `dh_local_dev`, database `digital_heroes`).

---

## Architecture

```
src/
  app/            Next.js App Router — routes, layouts, server actions
  db/
    schema/       Drizzle table definitions, one module per domain
    index.ts      Database client (node-postgres pool)
    migrate.ts    Migration runner
    seed.ts       Demo data
  lib/            Framework-agnostic domain logic
    constants.ts  Business rules lifted from the PRD
    money.ts      Integer money arithmetic and splits
    period.ts     Monthly draw periods
    password.ts   Hashing and verification
    env.ts        Validated environment configuration
drizzle/          Generated, committed SQL migrations
docs/             The PRD, and the decision log
```

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · PostgreSQL · Drizzle ORM · Stripe · Framer Motion.

### Key decisions

Some of the PRD's requirements are deliberately ambiguous. Every resolution is recorded, with its reasoning, in [`docs/DECISIONS.md`](docs/DECISIONS.md). The two that shape everything else:

**Scores are the draw numbers.** The PRD gives Stableford scores a range of 1–45 and says players keep their latest five (§05). Separately it describes a draw matching 3, 4 or 5 numbers (§06), without saying where a player's numbers come from. We treat them as the same thing: your five retained scores *are* your five numbers. The ranges line up exactly, playing golf becomes the way you enter, and "algorithmic draw weighted by score frequency" only has a coherent meaning if scores and numbers share a namespace.

**Money is integers, splits are snapshotted.** Every amount is stored as an integer in the currency's minor unit, and percentage splits use basis points — no floats anywhere. Each subscription payment is split into charity / prize pool / platform once, when it is received, and that split is *stored* rather than recomputed. Users change charities and raise their percentages; recomputing history from today's settings would silently rewrite what past charities were owed.

### Database

Local development runs Postgres in Docker; production targets Neon. Both use the
standard `node-postgres` driver against a standard connection string, so moving
between them is a change to `DATABASE_URL` and nothing else — there is no
environment-specific code path to test separately.

Migrations are generated as SQL and committed, never pushed ad-hoc, so schema
changes against a live database can be read before they run.

---

## Progress

- [x] **Phase 0** — Scaffold, Docker Postgres, schema, migrations, seed
- [x] **Phase 1** — Auth, roles, route guards, retro design system
- [x] **Phase 2** — Stripe subscriptions, Checkout, webhooks, lifecycle
- [x] **Phase 3** — Charity directory, selection, contributions
- [x] **Phase 4** — Score engine
- [x] **Phase 5** — Draw and prize engine
- [x] **Phase 6** — Winner verification, proof upload and payouts
- [x] **Phase 7** — User dashboard
- [x] **Phase 8** — Admin dashboard (users, draws, charities, winners, reports)
- [ ] **Phase 9** — Public site and UI polish
- [ ] **Phase 10** — Deployment
