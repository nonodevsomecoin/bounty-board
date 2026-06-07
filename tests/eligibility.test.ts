import { describe, it, expect, vi } from 'vitest';
import { checkEligibility, getWalletUsdValue } from '@/lib/eligibility';

describe('checkEligibility', () => {
  it('eligible when balance*price >= MIN_USD (10)', () => {
    const r = checkEligibility(100, 0.2); // $20
    expect(r.eligible).toBe(true);
    expect(r.usdValue).toBe(20);
  });

  it('not eligible below threshold', () => {
    const r = checkEligibility(10, 0.5); // $5
    expect(r.eligible).toBe(false);
    expect(r.usdValue).toBe(5);
  });

  it('exactly $10 is eligible', () => {
    expect(checkEligibility(40, 0.25).eligible).toBe(true); // $10
  });
});

describe('getWalletUsdValue', () => {
  it('multiplies fetched balance by fetched price', async () => {
    const deps = {
      getBalance: vi.fn().mockResolvedValue(50),
      getPrice: vi.fn().mockResolvedValue(0.4),
    };
    const usd = await getWalletUsdValue('WALLET', deps);
    expect(usd).toBe(20);
    expect(deps.getBalance).toHaveBeenCalledWith('WALLET');
    expect(deps.getPrice).toHaveBeenCalled();
  });
});
