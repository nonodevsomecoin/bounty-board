// pump.fun tokens trade on a bonding curve (DexScreener dexId "pumpfun") until
// they "graduate" and migrate to a real AMM — pumpswap, raydium, meteora, orca…
// At that point the bonding-curve pair is replaced by AMM pairs. So a token is
// considered migrated as soon as it has at least one pair on a DEX other than
// the pump.fun bonding curve. Non-pump.fun tokens (already on a real AMM) are
// therefore treated as migrated too, which is what we want: they get the normal
// holding check.
const DEXSCREENER = 'https://api.dexscreener.com/latest/dex/tokens';

const BONDING_CURVE_DEX = 'pumpfun';

export async function hasTokenMigrated(
  mint: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!mint) return false;
  try {
    const res = await fetchImpl(`${DEXSCREENER}/${mint}`);
    if (!res.ok) return false;
    const body = (await res.json()) as { pairs?: Array<{ dexId?: string }> };
    const pairs = body?.pairs ?? [];
    // Migrated once any pair lives on a DEX other than the bonding curve.
    return pairs.some((p) => p.dexId && p.dexId !== BONDING_CURVE_DEX);
  } catch {
    return false;
  }
}
