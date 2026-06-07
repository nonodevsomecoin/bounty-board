import { describe, it, expect, vi } from 'vitest';
import { getTokenPriceUsd } from '@/lib/price/jupiterPrice';

function fakeFetch(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe('getTokenPriceUsd', () => {
  it('parses the price for the mint', async () => {
    const mint = 'MINT123';
    const fetchImpl = fakeFetch({ data: { MINT123: { price: 0.37 } } });
    const price = await getTokenPriceUsd(mint, fetchImpl);
    expect(price).toBe(0.37);
  });

  it('returns 0 when the mint is absent from the response', async () => {
    const fetchImpl = fakeFetch({ data: {} });
    expect(await getTokenPriceUsd('NOPE', fetchImpl)).toBe(0);
  });

  it('returns 0 on a non-ok response', async () => {
    const fetchImpl = fakeFetch({}, false);
    expect(await getTokenPriceUsd('X', fetchImpl)).toBe(0);
  });
});
