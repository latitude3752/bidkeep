-- Idempotency ledger for the Stripe webhook. Stripe delivers webhooks
-- at-least-once, so the same event can arrive more than once (retries,
-- duplicate network delivery). Insert-or-skip on the event id makes each
-- event process exactly once regardless of how many times Stripe sends it.
create table if not exists public.stripe_events (
  id text primary key,
  created_at timestamptz not null default now()
);

alter table public.stripe_events enable row level security;
-- service role only; no anon/authenticated policies
