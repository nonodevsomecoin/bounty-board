import { createClient } from '@supabase/supabase-js';
import { requireEnv } from '@/lib/config';

// True once the public Supabase env vars are present. When false, read paths
// fall back to demo data so the site can be previewed without a backend.
export function isSupabaseConfigured(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

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
