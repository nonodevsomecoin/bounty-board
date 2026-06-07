import { verifySignature } from '@/lib/auth/signature';
import { buildMessage, extractTimestamp, isTimestampFresh } from '@/lib/auth/message';
import { getWalletUsdValue } from '@/lib/eligibility';
import { getTokenBalance } from '@/lib/solana/tokenBalance';
import { getTokenPriceUsd } from '@/lib/price/jupiterPrice';
import { SOLANA_RPC_URL, TOKEN_MINT, MIN_USD } from '@/lib/config';

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

// Verifies identity AND the $10 holding threshold.
export async function verifyHolder(
  body: SignedBody,
  spec: ActionSpec,
  nowMs = Date.now(),
): Promise<GuardResult> {
  const id = verifyIdentity(body, spec, nowMs);
  if (!id.ok) return id;
  const usd = await getWalletUsdValue(id.wallet, {
    getBalance: (w) => getTokenBalance(SOLANA_RPC_URL, w, TOKEN_MINT),
    getPrice: () => getTokenPriceUsd(TOKEN_MINT),
  });
  if (usd < MIN_USD) {
    return { ok: false, status: 403, error: 'You must hold at least $10 of the token' };
  }
  return { ok: true, wallet: id.wallet };
}
