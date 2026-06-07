import { describe, it, expect } from 'vitest';
import { sumTokenUiAmount } from '@/lib/solana/tokenBalance';

describe('sumTokenUiAmount', () => {
  it('sums uiAmount across parsed token accounts', () => {
    const parsed = {
      value: [
        { account: { data: { parsed: { info: { tokenAmount: { uiAmount: 12.5 } } } } } },
        { account: { data: { parsed: { info: { tokenAmount: { uiAmount: 7.5 } } } } } },
      ],
    };
    expect(sumTokenUiAmount(parsed)).toBe(20);
  });

  it('returns 0 when there are no accounts', () => {
    expect(sumTokenUiAmount({ value: [] })).toBe(0);
  });

  it('treats null uiAmount as 0', () => {
    const parsed = {
      value: [
        { account: { data: { parsed: { info: { tokenAmount: { uiAmount: null } } } } } },
      ],
    };
    expect(sumTokenUiAmount(parsed)).toBe(0);
  });
});
