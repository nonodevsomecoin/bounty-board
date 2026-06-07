import { describe, it, expect } from 'vitest';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import {
  verifySignature,
  buildMessage,
  extractTimestamp,
  isTimestampFresh,
} from '@/lib/auth/signature';

function signAs(message: string) {
  const kp = nacl.sign.keyPair();
  const sig = nacl.sign.detached(new TextEncoder().encode(message), kp.secretKey);
  return {
    wallet: bs58.encode(kp.publicKey),
    signature: bs58.encode(sig),
  };
}

describe('verifySignature', () => {
  it('accepts a valid signature', () => {
    const msg = 'hello';
    const { wallet, signature } = signAs(msg);
    expect(verifySignature(wallet, msg, signature)).toBe(true);
  });

  it('rejects a tampered message', () => {
    const { wallet, signature } = signAs('hello');
    expect(verifySignature(wallet, 'goodbye', signature)).toBe(false);
  });

  it('rejects a signature from a different wallet', () => {
    const { signature } = signAs('hello');
    const other = signAs('hello');
    expect(verifySignature(other.wallet, 'hello', signature)).toBe(false);
  });

  it('returns false on malformed input instead of throwing', () => {
    expect(verifySignature('not-base58!!', 'm', 'also-bad')).toBe(false);
  });
});

describe('message helpers', () => {
  it('builds a message containing the action and timestamp', () => {
    const msg = buildMessage('vote', 1000);
    expect(msg).toContain('vote');
    expect(extractTimestamp(msg)).toBe(1000);
  });

  it('extractTimestamp returns null when absent', () => {
    expect(extractTimestamp('no timestamp here')).toBeNull();
  });

  it('isTimestampFresh true within skew, false outside', () => {
    expect(isTimestampFresh(1000, 1000 + 60_000)).toBe(true);
    expect(isTimestampFresh(1000, 1000 + 5 * 60_000)).toBe(false);
  });
});
