import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { SIGNATURE_MAX_SKEW_MS } from '@/lib/config';

export function buildMessage(action: string, timestampMs: number): string {
  return [
    `$TICKER Bounties — proving wallet ownership to ${action}.`,
    `Timestamp: ${timestampMs}`,
  ].join('\n');
}

export function extractTimestamp(message: string): number | null {
  const m = message.match(/Timestamp:\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

export function isTimestampFresh(
  timestampMs: number,
  nowMs: number,
  maxSkewMs: number = SIGNATURE_MAX_SKEW_MS,
): boolean {
  return Math.abs(nowMs - timestampMs) <= maxSkewMs;
}

export function verifySignature(
  walletBase58: string,
  message: string,
  signatureBase58: string,
): boolean {
  try {
    const pub = bs58.decode(walletBase58);
    const sig = bs58.decode(signatureBase58);
    const msg = new TextEncoder().encode(message);
    return nacl.sign.detached.verify(msg, sig, pub);
  } catch {
    return false;
  }
}
