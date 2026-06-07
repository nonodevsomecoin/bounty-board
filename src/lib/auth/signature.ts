import nacl from 'tweetnacl';
import bs58 from 'bs58';

// Re-export message helpers so existing imports from this module keep working.
export { buildMessage, extractTimestamp, isTimestampFresh } from '@/lib/auth/message';

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
