'use client';
import { useWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';

export interface SignedPayload {
  wallet: string;
  message: string;
  signature: string;
}

export function useSignedAction() {
  const { publicKey, signMessage } = useWallet();

  async function sign(action: string): Promise<SignedPayload> {
    if (!publicKey || !signMessage) throw new Error('Connect your wallet first');
    const ts = Date.now();
    const message = `$TICKER Bounties — proving wallet ownership to ${action}.\nTimestamp: ${ts}`;
    const sig = await signMessage(new TextEncoder().encode(message));
    return {
      wallet: publicKey.toBase58(),
      message,
      signature: bs58.encode(sig),
    };
  }

  return { connected: !!publicKey, sign };
}
