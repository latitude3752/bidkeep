# BidKeep

A federal opportunity tracker for **facilities and building services** —
janitorial, grounds/landscaping, guard services, and facilities support.
The fourth Bid* product under [Fountain City Capital, LLC](https://fountaincitycapital.com).

Tracks two complementary signals:

- **Contracts** — SAM.gov solicitations, synced daily by facilities NAICS
  code (core: `561210`, `561612`, `561720`, `561730`, plus adjacent
  building-services codes), classified for program scale (BPA/IDIQ ceiling
  vs. a plain RFQ), and tagged with place-of-performance state so a firm
  can filter to sites it can actually staff.
- **Grants** — federal grant awards (USAspending.gov) plus upcoming
  funding-cycle openings (Grants.gov) for community facilities, public
  housing, weatherization, and related Assistance Listings.

Surfaced through public preview pages (`/opportunities`, `/grants`, `/demo`)
plus a subscriber pipeline (`/app`) and founder admin (`/admin`).

Forked from the BidYard / BidHawk App Router stack (SAM.gov +
USAspending + Grants.gov + Bonfire), rebranded and reseeded for this
vertical. Domain: [trybidkeep.com](https://trybidkeep.com).

Public sample lists label **Open** notices (future response deadline)
separately from **Recent opportunity example** rows (historical or
scaffold samples). The teaser is diversified by agency and NAICS so one
department or code cannot fill the page.

## Pricing

$100/month, up to 5 seats per company. Stripe Payment Link is an
environment placeholder — do not invent a live checkout URL.

## Stack

Next.js 16 App Router, Supabase (Postgres + RLS), Tailwind CSS, Vitest,
`@netacracy/bid-core` (shared Bid* SAM/NAICS/sync engine).

## Setup

Do **not** reuse another Bid* product's Supabase project or secrets.

1. Create a **new** Supabase project for BidKeep.
2. Apply `supabase/migrations/` in filename order (`supabase db push` or
   `node scripts/run-migration.mjs <file>` against
   `POSTGRES_URL_NON_POOLING`).
3. Get a free SAM.gov API key: https://sam.gov/data-services — needed for
   `/api/sync-opportunities` only. Grants sync needs no API key.
4. Copy `.env.example` to `.env.local` and fill in the variables below.
5. `npm install`
6. `npm run dev` → http://localhost:3000
7. Seed data (optional, once secrets exist):
   ```
   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/sync-opportunities
   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/sync-grants
   ```
8. Sign in at `/admin/login` with `ADMIN_PASSWORD`. Create a seat on
   `/admin/subscribers`, then sign in at `/login` for `/app`.

Without Supabase env vars the marketing pages still render using labeled
example opportunities and the seeded facilities NAICS list.

## Environment variables

See `.env.example` for the full list. Required for a live product:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public RLS-gated reads |
| `SUPABASE_SERVICE_ROLE_KEY` | Server/admin writes |
| `POSTGRES_URL_NON_POOLING` | Applying SQL migrations from `scripts/` |
| `SAM_GOV_API_KEY` | Direct SAM.gov contract sync |
| `ADMIN_PASSWORD` | Founder `/admin` login |
| `CRON_SECRET` | Bearer token for cron routes |
| `SUBSCRIBER_SESSION_SECRET` | HMAC for subscriber cookies |
| `NEXT_PUBLIC_SITE_URL` | Canonical / OG / sitemap URL (`https://trybidkeep.com` in prod) |

Optional:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_URL` | Stripe Payment Link for `/start`. Leave unset to show the contact-form fallback. Do not invent a live URL. |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_ID` | Self-serve seat provisioning via `/api/stripe-webhook` |
| `NOTIFY_EMAIL_TO` / `FOUNDER_DIGEST_BCC` | Digest and sync-error mail |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Outbound email |
| `TRUST_PROXY_HEADERS` | Self-hosting only; leave unset on Vercel |
| `SAM_RELAY_SECRET` | Shared BidHawk relay ingest (`/api/ingest-opportunities`, `/api/naics-codes`) |

## Cron stubs

`vercel.json` schedules (staggered after BidHawk / BidYard / BidPulse):

- `/api/sync-opportunities` — `0 16 * * *`
- `/api/sync-grants` — `30 16 * * *`
- `/api/sync-bonfire` — `0 17 * * *`
- `/api/check-sync-freshness` — `0 23 * * *`

Each route expects `Authorization: Bearer $CRON_SECRET`.

## Testing

`npm test` (Vitest) covers SAM/USAspending/Grants.gov parsing, program
scale, public-sample diversity, live-vs-example deadline labeling, and
mocked sync orchestration.

## Operator

Ben Alexander  
Fountain City Capital, LLC  
4016 Hardwood Way, Midland, GA 31820-4135  
ben.alexander@fountaincitycapital.com  
+1 706-580-1925
