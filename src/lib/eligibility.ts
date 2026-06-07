import { MIN_USD } from '@/lib/config';

export interface EligibilityResult {
  eligible: boolean;
  usdValue: number;
}

export function checkEligibility(
  balanceTokens: number,
  priceUsd: number,
  minUsd: number = MIN_USD,
): EligibilityResult {
  const usdValue = balanceTokens * priceUsd;
  return { eligible: usdValue >= minUsd, usdValue };
}

export interface UsdValueDeps {
  getBalance: (wallet: string) => Promise<number>;
  getPrice: () => Promise<number>;
}

export async function getWalletUsdValue(
  wallet: string,
  deps: UsdValueDeps,
): Promise<number> {
  const [balance, price] = await Promise.all([
    deps.getBalance(wallet),
    deps.getPrice(),
  ]);
  return balance * price;
}
