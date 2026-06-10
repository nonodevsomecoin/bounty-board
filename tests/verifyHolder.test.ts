import { describe, it, expect, vi } from 'vitest';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { verifyHolder, type HolderDeps } from '@/lib/auth/guard';
import { buildMessage } from '@/lib/auth/message';

const MINT = 'So11111111111111111111111111111111111111112';

function signedBody(action: string, ts: number, resourceId?: string) {
  const kp = nacl.sign.keyPair();
  const message = buildMessage(action, ts, resourceId);
  const sig = nacl.sign.detached(new TextEncoder().encode(message), kp.secretKey);
  return { wallet: bs58.encode(kp.publicKey), message, signature: bs58.encode(sig) };
}

function deps(over: Partial<HolderDeps> = {}): HolderDeps {
  return {
    getMint: vi.fn().mockResolvedValue(MINT),
    hasMigrated: vi.fn().mockResolvedValue(true),
    getPrice: vi.fn().mockResolvedValue(0.5),
    getBalance: vi.fn().mockResolvedValue(100), // $50 by default
    ...over,
  };
}

describe('verifyHolder migration gate', () => {
  const now = 1_000_000;

  it('skips the holding check (wallet connection only) while the token is on the bonding curve', async () => {
    const d = deps({
      hasMigrated: vi.fn().mockResolvedValue(false),
      getBalance: vi.fn().mockResolvedValue(0), // holds nothing
    });
    const r = await verifyHolder(signedBody('propose', now), { action: 'propose' }, now, d);
    expect(r.ok).toBe(true);
    expect(d.getBalance).not.toHaveBeenCalled(); // no balance lookup pre-migration
    expect(d.getPrice).not.toHaveBeenCalled();
  });

  it('enforces the $10 threshold once the token has migrated', async () => {
    const d = deps({
      getPrice: vi.fn().mockResolvedValue(0.01),
      getBalance: vi.fn().mockResolvedValue(100), // $1
    });
    const r = await verifyHolder(signedBody('propose', now), { action: 'propose' }, now, d);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it('accepts a sufficient holder once the token has migrated', async () => {
    const d = deps(); // 100 * 0.5 = $50
    const r = await verifyHolder(signedBody('propose', now), { action: 'propose' }, now, d);
    expect(r.ok).toBe(true);
  });

  it('does not false-reject when a migrated token is momentarily unpriced', async () => {
    const d = deps({
      getPrice: vi.fn().mockResolvedValue(0),
      getBalance: vi.fn().mockResolvedValue(0),
    });
    const r = await verifyHolder(signedBody('propose', now), { action: 'propose' }, now, d);
    expect(r.ok).toBe(true);
  });

  it('still rejects an invalid signature regardless of migration state', async () => {
    const body = signedBody('propose', now);
    const r = await verifyHolder(
      { ...body, message: body.message + ' ' },
      { action: 'propose' },
      now,
      deps({ hasMigrated: vi.fn().mockResolvedValue(false) }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it('returns 503 when no mint is configured', async () => {
    const r = await verifyHolder(
      signedBody('propose', now),
      { action: 'propose' },
      now,
      deps({ getMint: vi.fn().mockResolvedValue('') }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(503);
  });
});
