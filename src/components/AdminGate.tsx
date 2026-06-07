'use client';
import { useWallet } from '@solana/wallet-adapter-react';
import { ConnectWallet } from './ConnectWallet';
import { isPreviewMode } from '@/lib/config';

export function AdminGate({ children }: { children: React.ReactNode }) {
  const { connected } = useWallet();
  // In preview mode (no backend yet) show the moderation UI directly so it can
  // be viewed without a wallet. Real admin auth is always enforced server-side.
  if (!connected && !isPreviewMode()) {
    return (
      <div className="admin-gate">
        <p>Connect an admin wallet to moderate.</p>
        <ConnectWallet />
      </div>
    );
  }
  return <>{children}</>;
}
