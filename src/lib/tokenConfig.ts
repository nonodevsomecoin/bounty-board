import { getSetting } from '@/lib/db/settings';
import { isDbConfigured } from '@/lib/config';

// Resolves the live token mint address. Priority: the value set in the admin
// panel (stored in the DB) so it can be activated instantly at launch without a
// redeploy; falls back to the build-time NEXT_PUBLIC_TOKEN_MINT env var.
export async function getTokenMint(): Promise<string> {
  if (isDbConfigured()) {
    const dbMint = (await getSetting('token_mint'))?.trim();
    if (dbMint) return dbMint;
  }
  return (process.env.NEXT_PUBLIC_TOKEN_MINT ?? '').trim();
}
