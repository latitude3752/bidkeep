<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# BidKeep — agent rules

The founder is **Ben**. Address him as Ben on every machine and every agent.

A federal opportunity tracker for facilities and building services
(janitorial, grounds, guard, facilities support), forked from the Bid*
SAM.gov stack — see README.md for what it is and current build status.

## Local-first

Work locally. Do **not** `git push`, `supabase db push`, or deploy to
Vercel unless the founder explicitly says to ship after localhost
verification.

This repo has its own git history, separate from BidYard, BidHawk,
BidPulse, and fountain-city-capital. Do not add a cross-repo sync
workflow without being asked.

## Default loop

1. Edit in this repo only. Do not read from or write to sibling Bid*
   products — this product's whole point is a clean IP boundary.
2. `npm install` then `npm run dev` → http://localhost:3000
3. `npm test` after touching `src/lib/`.
4. `npm run build` before anything that touches the SAM.gov sync route,
   Supabase queries, or page rendering.
5. **Stop.** Ask before any git / Supabase / Vercel write, and before
   provisioning a new Supabase project or SAM.gov API key on Ben's behalf.
6. Do **not** invent a live Stripe Payment Link URL. Leave
   `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_URL` as an env placeholder.

## Stack

- Next.js 16 App Router at repo root (not a monorepo).
- Supabase (Postgres + RLS) for `opportunities` and `naics_codes`.
- Founder `/admin` vs subscriber `/app`; any number of companies, max 5 seats each.

## Do not

- Reuse BidHawk's, BidYard's, BidPulse's, fountain-city-capital's, or any
  other project's Supabase credentials, API keys, or `.env.local`.
- Reintroduce construction, UAS/drone, or medical copy, NAICS, or sample
  opportunities. This vertical is facilities and building services.
- Add back a Blue UAS Cleared List-style feature.
- Reintroduce a title-keyword relevance filter or wide-net keyword search
  pass on top of NAICS/ALN matching unless there is a confirmed
  false-negative problem to solve.
- Treat `docs/certifications/` or `docs/proposals/`-style business
  documents as belonging in this repo.
