import { TOKEN_MINT } from '@/lib/config';

// Token USD price with two sources for resilience (important for freshly
// launched pump.fun tokens): Jupiter Price API v3 first, then DexScreener,
// which indexes new Solana/pump.fun pairs very quickly.
const JUP_V3 = 'https://lite-api.jup.ag/price/v3';
const DEXSCREENER = 'https://api.dexscreener.com/latest/dex/tokens';

async function fromJupiter(mint: string, fetchImpl: typeof fetch): Promise<number> {
  try {
    const res = await fetchImpl(`${JUP_V3}?ids=${mint}`);
    if (!res.ok) return 0;
    const body = (await res.json()) as Record<string, { usdPrice?: number }>;
    const p = body?.[mint]?.usdPrice;
    return typeof p === 'number' && p > 0 ? p : 0;
  } catch {
    return 0;
  }
}

async function fromDexScreener(mint: string, fetchImpl: typeof fetch): Promise<number> {
  try {
    const res = await fetchImpl(`${DEXSCREENER}/${mint}`);
    if (!res.ok) return 0;
    const body = (await res.json()) as { pairs?: Array<{ priceUsd?: string }> };
    for (const pair of body?.pairs ?? []) {
      const p = pair.priceUsd ? parseFloat(pair.priceUsd) : 0;
      if (p > 0) return p;
    }
    return 0;
  } catch {
    return 0;
  }
}

export async function getTokenPriceUsd(
  mint: string = TOKEN_MINT,
  fetchImpl: typeof fetch = fetch,
): Promise<number> {
  if (!mint) return 0;
  const jup = await fromJupiter(mint, fetchImpl);
  if (jup > 0) return jup;
  return fromDexScreener(mint, fetchImpl);
}

// Jupiter-only price. 0 means Jupiter does not (yet) index/price this mint —
// used as the signal for "the token isn't live on Jupiter yet".
export async function getJupiterPriceUsd(
  mint: string = TOKEN_MINT,
  fetchImpl: typeof fetch = fetch,
): Promise<number> {
  if (!mint) return 0;
  return fromJupiter(mint, fetchImpl);
}
