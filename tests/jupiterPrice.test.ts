import { describe, it, expect, vi } from 'vitest';
import { getTokenPriceUsd } from '@/lib/price/jupiterPrice';

const MINT = 'MINT123';

function mockFetch(handler: (url: string) => { ok: boolean; body: unknown }) {
  return vi.fn(async (url: string) => {
    const { ok, body } = handler(String(url));
    return { ok, json: async () => body } as Response;
  }) as unknown as typeof fetch;
}

describe('getTokenPriceUsd', () => {
  it('uses Jupiter v3 usdPrice when available', async () => {
    const f = mockFetch((url) =>
      url.includes('jup.ag')
        ? { ok: true, body: { [MINT]: { usdPrice: 0.37 } } }
        : { ok: true, body: { pairs: [] } },
    );
    expect(await getTokenPriceUsd(MINT, f)).toBe(0.37);
  });

  it('falls back to DexScreener when Jupiter has no price', async () => {
    const f = mockFetch((url) =>
      url.includes('jup.ag')
        ? { ok: true, body: {} }
        : { ok: true, body: { pairs: [{ priceUsd: '0.0125' }] } },
    );
    expect(await getTokenPriceUsd(MINT, f)).toBe(0.0125);
  });

  it('skips empty DexScreener pairs and takes the first priced one', async () => {
    const f = mockFetch((url) =>
      url.includes('jup.ag')
        ? { ok: true, body: {} }
        : { ok: true, body: { pairs: [{ priceUsd: '0' }, { priceUsd: '0.5' }] } },
    );
    expect(await getTokenPriceUsd(MINT, f)).toBe(0.5);
  });

  it('returns 0 when neither source has a price', async () => {
    const f = mockFetch(() => ({ ok: true, body: {} }));
    expect(await getTokenPriceUsd(MINT, f)).toBe(0);
  });

  it('returns 0 on non-ok responses from both', async () => {
    const f = mockFetch(() => ({ ok: false, body: {} }));
    expect(await getTokenPriceUsd(MINT, f)).toBe(0);
  });

  it('returns 0 for an empty mint', async () => {
    const f = mockFetch(() => ({ ok: true, body: { '': { usdPrice: 1 } } }));
    expect(await getTokenPriceUsd('', f)).toBe(0);
  });
});
