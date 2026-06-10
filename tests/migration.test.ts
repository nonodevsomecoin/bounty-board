import { describe, it, expect, vi } from 'vitest';
import { hasTokenMigrated } from '@/lib/token/migration';

const MINT = '4g4aurPiPyy5A7P7RvmZAGpAYssMbdLcu7BhX8cNpump';

function fetchReturning(pairs: Array<{ dexId: string }> | null, ok = true): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok,
    json: async () => (pairs === null ? {} : { pairs }),
  }) as unknown as typeof fetch;
}

describe('hasTokenMigrated', () => {
  it('false while only on the pump.fun bonding curve', async () => {
    expect(await hasTokenMigrated(MINT, fetchReturning([{ dexId: 'pumpfun' }]))).toBe(false);
  });

  it('true once a real AMM pair exists (pumpswap)', async () => {
    const f = fetchReturning([{ dexId: 'pumpfun' }, { dexId: 'pumpswap' }]);
    expect(await hasTokenMigrated(MINT, f)).toBe(true);
  });

  it('true for a graduated token on multiple AMMs', async () => {
    const f = fetchReturning([{ dexId: 'raydium' }, { dexId: 'orca' }, { dexId: 'meteora' }]);
    expect(await hasTokenMigrated(MINT, f)).toBe(true);
  });

  it('false when DexScreener has no pairs yet', async () => {
    expect(await hasTokenMigrated(MINT, fetchReturning([]))).toBe(false);
  });

  it('false on a non-OK response (fail-open: do not enforce)', async () => {
    expect(await hasTokenMigrated(MINT, fetchReturning(null, false))).toBe(false);
  });

  it('false for an empty mint', async () => {
    expect(await hasTokenMigrated('', fetchReturning([{ dexId: 'raydium' }]))).toBe(false);
  });
});
