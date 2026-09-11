-- SECURITY FIX: sync_runs was created without RLS. Supabase's PostgREST
-- exposes every public-schema table over the anon key by default, so this
-- table was writable/readable by anyone holding bidkeep's public anon key
-- (shipped in the client bundle) -- someone could insert fake zero-error
-- rows to mask a genuinely broken sync on /admin/sync-status and the daily
-- freshness check, or read internal error strings.
--
-- Same gap, same fix, already applied to bidhawk's sync_runs in
-- 20260907170000_relay_deliveries_lockdown.sql; never ported to this app.
--
-- All app code reads/writes this table exclusively through
-- getSupabaseAdmin() (service-role, bypasses RLS) -- confirmed via
-- @netacracy/bid-core's sync-runs.ts. Enabling RLS with zero policies
-- breaks nothing for legitimate use.

alter table public.sync_runs enable row level security;
-- service role only; no anon/authenticated policies
