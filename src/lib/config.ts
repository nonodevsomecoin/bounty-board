// Server-side env reads + tunable constants.
export const MIN_USD = 10;                 // holding threshold to post/vote
export const COOLDOWN_MS = 5 * 60 * 1000;  // 5 minutes between proposals
export const SIGNATURE_MAX_SKEW_MS = 2 * 60 * 1000; // signed message freshness

export const TOKEN_MINT = process.env.NEXT_PUBLIC_TOKEN_MINT ?? '';
export const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

// True once the backend is fully wired (Supabase + token mint). When false, the
// app runs in preview mode: read paths show demo data and write routes return a
// friendly 503 instead of crashing. Server-only (checks the service-role key).
export function isBackendConfigured(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
    !!process.env.NEXT_PUBLIC_TOKEN_MINT
  );
}

// Client-safe preview check: only inspects NEXT_PUBLIC_ vars (the service-role
// key is never in the client bundle), so this is usable in client components.
export function isPreviewMode(): boolean {
  return (
    !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_TOKEN_MINT
  );
}
