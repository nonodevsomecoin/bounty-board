import { verifySignature } from '@/lib/auth/signature';
import { buildMessage, extractTimestamp, isTimestampFresh } from '@/lib/auth/message';
import { checkEligibility } from '@/lib/eligibility';
import { getTokenBalance } from '@/lib/solana/tokenBalance';
import { getTokenPriceUsd } from '@/lib/price/jupiterPrice';
import { hasTokenMigrated } from '@/lib/token/migration';
import { SOLANA_RPC_URL } from '@/lib/config';
import { getTokenMint } from '@/lib/tokenConfig';

export interface SignedBody {
  wallet?: unknown;
  message?: unknown;
  signature?: unknown;
}

export interface ActionSpec {
  action: string;
  resourceId?: string;
}

export type GuardResult =
  | { ok: true; wallet: string }
  | { ok: false; status: number; error: string };

// Verifies signature + freshness + that the signed message matches this exact
// action (and resource id, if any). Does NOT check holdings.
export function verifyIdentity(
  body: SignedBody,
  spec: ActionSpec,
  nowMs = Date.now(),
): GuardResult {
  const { wallet, message, signature } = body;
  if (typeof wallet !== 'string' || typeof message !== 'string' || typeof signature !== 'string') {
    return { ok: false, status: 400, error: 'Missing wallet, message, or signature' };
  }
  if (!verifySignature(wallet, message, signature)) {
    return { ok: false, status: 401, error: 'Invalid signature' };
  }
  const ts = extractTimestamp(message);
  if (ts === null || !isTimestampFresh(ts, nowMs)) {
    return { ok: false, status: 401, error: 'Signature expired, please retry' };
  }
  if (message !== buildMessage(spec.action, ts, spec.resourceId)) {
    return { ok: false, status: 401, error: 'Signature does not match this action' };
  }
  return { ok: true, wallet };
}

// Injectable side-effects so the holding logic can be unit-tested.
export interface HolderDeps {
  getMint: () => Promise<string>;
  hasMigrated: (mint: string) => Promise<boolean>;
  getPrice: (mint: string) => Promise<number>;
  getBalance: (wallet: string, mint: string) => Promise<number>;
}

const defaultHolderDeps: HolderDeps = {
  getMint: getTokenMint,
  hasMigrated: (mint) => hasTokenMigrated(mint),
  getPrice: (mint) => getTokenPriceUsd(mint),
  getBalance: (wallet, mint) => getTokenBalance(SOLANA_RPC_URL, wallet, mint),
};

// Verifies identity AND, once the token has migrated off the pump.fun bonding
// curve to a real DEX, the $10 holding threshold. While the token is still on
// the bonding curve (pre-graduation), holders may not have bought in yet, so a
// connected + signature-verified wallet is enough. The threshold engages
// automatically the moment the token migrates.
export async function verifyHolder(
  body: SignedBody,
  spec: ActionSpec,
  nowMs = Date.now(),
  deps: HolderDeps = defaultHolderDeps,
): Promise<GuardResult> {
  const id = verifyIdentity(body, spec, nowMs);
  if (!id.ok) return id;
  const mint = await deps.getMint();
  if (!mint) {
    return {
      ok: false,
      status: 503,
      error: 'Proposals and voting open when the token goes live. Stay tuned! 🚀',
    };
  }
  const migrated = await deps.hasMigrated(mint);
  if (!migrated) {
    // Still on the bonding curve — wallet connection is all we require.
    return { ok: true, wallet: id.wallet };
  }
  const price = await deps.getPrice(mint);
  if (price <= 0) {
    // Migrated but momentarily unpriced — don't false-reject a real holder.
    return { ok: true, wallet: id.wallet };
  }
  const balance = await deps.getBalance(id.wallet, mint);
  if (!checkEligibility(balance, price).eligible) {
    return { ok: false, status: 403, error: 'You must hold at least $10 of the token' };
  }
  return { ok: true, wallet: id.wallet };
}
