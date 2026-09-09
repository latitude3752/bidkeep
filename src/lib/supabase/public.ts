import { createClient } from "@supabase/supabase-js";

/** Anon-key client for public, RLS-gated reads (naics_codes). */
export function getSupabasePublic() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
