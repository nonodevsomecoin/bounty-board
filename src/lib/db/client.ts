import { createClient } from '@supabase/supabase-js';
import { requireEnv } from '@/lib/config';

// Read-only public client (anon key) — used by Server Components.
export function supabaseAnon() {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    { auth: { persistSession: false } },
  );
}

// Privileged client (service role) — used ONLY in API routes. Bypasses RLS.
export function supabaseServer() {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
  );
}
