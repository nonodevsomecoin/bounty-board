import { describe, it, expect } from 'vitest';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { verifyIdentity } from '@/lib/auth/guard';
import { buildMessage } from '@/lib/auth/message';

function signedBody(action: string, ts: number, resourceId?: string) {
  const kp = nacl.sign.keyPair();
  const message = buildMessage(action, ts, resourceId);
  const sig = nacl.sign.detached(new TextEncoder().encode(message), kp.secretKey);
  return { wallet: bs58.encode(kp.publicKey), message, signature: bs58.encode(sig) };
}

describe('verifyIdentity action binding', () => {
  const now = 1_000_000;

  it('accepts a message signed for the matching action + resource', () => {
    const body = signedBody('vote', now, 'b1');
    const r = verifyIdentity(body, { action: 'vote', resourceId: 'b1' }, now);
    expect(r.ok).toBe(true);
  });

  it('rejects when the action differs (cross-action replay)', () => {
    const body = signedBody('vote', now, 'b1');
    const r = verifyIdentity(body, { action: 'delete', resourceId: 'b1' }, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it('rejects when the resource id differs', () => {
    const body = signedBody('vote', now, 'b1');
    const r = verifyIdentity(body, { action: 'vote', resourceId: 'b2' }, now);
    expect(r.ok).toBe(false);
  });

  it('rejects a stale timestamp', () => {
    const body = signedBody('propose', now);
    const r = verifyIdentity(body, { action: 'propose' }, now + 5 * 60_000);
    expect(r.ok).toBe(false);
  });

  it('rejects a tampered message body', () => {
    const body = signedBody('vote', now, 'b1');
    const r = verifyIdentity({ ...body, message: body.message + ' ' }, { action: 'vote', resourceId: 'b1' }, now);
    expect(r.ok).toBe(false);
  });
});
