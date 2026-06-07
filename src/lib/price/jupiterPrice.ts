import { TOKEN_MINT } from '@/lib/config';

// Jupiter Lite price API: https://lite-api.jup.ag/price/v2?ids=<mint>
const JUP_URL = 'https://lite-api.jup.ag/price/v2';

export async function getTokenPriceUsd(
  mint: string = TOKEN_MINT,
  fetchImpl: typeof fetch = fetch,
): Promise<number> {
  try {
    const res = await fetchImpl(`${JUP_URL}?ids=${mint}`);
    if (!res.ok) return 0;
    const body = (await res.json()) as { data?: Record<string, { price?: number }> };
    const price = body.data?.[mint]?.price;
    return typeof price === 'number' ? price : 0;
  } catch {
    return 0;
  }
}
