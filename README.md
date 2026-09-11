# BidKeep

A federal opportunity tracker for **federal facilities and building
services** — janitorial, grounds/landscaping, security guards/patrol, and
facilities support / base ops. Tracks two complementary signals:

- **Contracts** — SAM.gov solicitations, synced daily by facilities NAICS
  (561210, 561720, 561730, 561612, plus adjacents 561790, 561740, 561621).
  Set-aside type (SDVOSB / 8(a) / HUBZone / WOSB / SB) is shown on every
  public sample row. Notices are tagged with place-of-performance state
  and classified for program scale (BPA/IDIQ vs. a plain RFQ).
- **Grants** — a narrower, secondary feed. Facilities is mostly contracts;
  public-housing capital, community-facilities, and energy-efficiency
  awards (from USAspending.gov + Grants.gov) can precede janitorial or
  base-ops work. Not a highway/civil construction grant list.

Surfaced through public preview pages (`/opportunities`, `/radar`,
`/grants`, `/set-asides`) plus a subscriber pipeline
(`/admin/opportunities`, `/app`, `/app/radar`).

Forked from the BidYard / BidPulse Bid* app pattern, sharing
`@netacracy/bid-core`. There is no drone / Blue UAS content. The
facilities trust page is **Set-asides & SCA** (`/set-asides`): we surface
SAM.gov set-aside fields and any WD number / link the notice actually
includes. Mentions without a number stay empty — we do not invent DOL
rates. The **recompete radar** (`/radar`, `/app/radar`) classifies
option-year, period-of-performance, and follow-on language from title,
notice type, `raw_data`, and `requirements_text`, and persists those
columns so the list can query without reparsing.

## Status

MVP: SAM.gov contracts + a tuned grants feed, facilities NAICS seed,
set-aside badges on public samples, recompete radar (option / expiration /
follow-on signals from notice language), deadline-first pipeline with live +
`isExample` fallback and agency/NAICS diversity. Billing is env-driven
Stripe Payment Link — no live Payment Link is checked in.

## Stack

Next.js 16 App Router, Supabase (Postgres + RLS), Tailwind CSS, Vitest,
`@netacracy/bid-core`.

## Seeded NAICS

| Code   | Label                                          | Role      |
| ------ | ---------------------------------------------- | --------- |
| 561210 | Facilities Support Services                    | Core      |
| 561720 | Janitorial Services                            | Core      |
| 561730 | Landscaping Services                           | Core      |
| 561612 | Security Guards and Patrol Services            | Core      |
| 561790 | Other Services to Buildings and Dwellings      | Adjacent  |
| 561740 | Carpet and Upholstery Cleaning Services        | Adjacent  |
| 561621 | Security Systems Services (except Locksmiths)  | Adjacent  |

## Setup

1. Create a **new** Supabase project for BidKeep (do not reuse BidYard,
   BidHawk, BidPulse, or fountain-city-capital credentials).
2. Apply the migrations in `supabase/migrations/` in filename order, either
   via `supabase db push` (Supabase CLI) or `node scripts/run-migration.mjs
   <file>` against `POSTGRES_URL_NON_POOLING`.
3. Get a free SAM.gov API key: https://sam.gov/data-services — needed for
   contracts only. The grants sync (USAspending.gov + Grants.gov) needs no
   API key.
4. Copy `.env.example` to `.env.local` and fill in Supabase, SAM.gov,
   `ADMIN_PASSWORD`/`CRON_SECRET`, and (for subscriber seats)
   `SUBSCRIBER_SESSION_SECRET`. Leave
   `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_URL` unset until you create a Payment
   Link in Stripe. Set `NEXT_PUBLIC_SITE_URL` to `https://trybidkeep.com`
   in production (domain not registered yet — placeholder).
5. `npm install`
6. `npm run dev` → http://localhost:3000
7. Trigger both syncs manually to seed data:
   ```
   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/sync-opportunities
   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/sync-grants
   ```
8. Sign in at `/admin/login` with `ADMIN_PASSWORD` to see both pipelines
   (`/admin/opportunities`, `/admin/grants`).
9. Create a seat on `/admin/subscribers`, then sign in at `/login` to use
   the subscriber app (`/app`).

## Environment variables

See `.env.example`. Required for a working deploy:

| Variable | Purpose |
| -------- | ------- |
| `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (RLS) client |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin / sync writes |
| `SAM_GOV_API_KEY` | Contract sync |
| `ADMIN_PASSWORD` | Founder `/admin` |
| `CRON_SECRET` | Bearer token for sync crons |
| `SUBSCRIBER_SESSION_SECRET` | HMAC for `/app` seats |
| `NEXT_PUBLIC_SITE_URL` | Canonical / OG / sitemap |
| `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_URL` | Optional; `/start` checkout |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_ID` | Optional self-serve provisioning |
| `SMTP_*` + `FOUNDER_DIGEST_BCC` | Optional email digest |

## Deploy (Vercel team Netacracy)

1. Import `latitude3752/bidkeep` into the **Netacracy** Vercel team.
   Framework: Next.js. Default branch: `main` (or `master` if you rename
   to match the rest of the Bid* family).
2. Set the env vars above on Production + Preview.
3. Production domain (when registered): `trybidkeep.com` → add in Vercel
   Domains, then DNS at the registrar.
4. Crons are declared in `vercel.json` (`/api/sync-grants`,
   `/api/sync-bonfire`, `/api/check-sync-freshness`). Also schedule
   `/api/sync-opportunities` if this project does a direct SAM.gov pull
   (the Bid* family may instead ingest via the shared relay —
   `/api/ingest-opportunities` + `/api/naics-codes`).
5. After first deploy, run both syncs once and confirm `/opportunities`
   shows live or `isExample` rows.

## Testing

`npm test` (Vitest) covers SAM.gov / USAspending / Grants.gov query
building, public-sample diversity, set-aside labels, recompete / option /
expiration classification, SCA WD extraction, and mocked sync routes.

`npm run build` should pass without a live Supabase project (public pages
catch empty data).

## Operator

Fountain City Capital, LLC — same legal identity as BidYard.
Midland, GA. ben.alexander@fountaincitycapital.com.
Portfolio: https://fountaincitycapital.com
Price: $100/mo, up to 5 seats.

## What Ben still provisions

- Supabase project + apply migrations
- Vercel project on team Netacracy
- DNS for trybidkeep.com (not registered yet)
- Stripe Payment Link + `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_URL` (and
  optional webhook / `STRIPE_PRICE_ID`)
- SAM.gov API key
- SMTP if you want the digest live
