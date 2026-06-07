'use client';
import { useWallet } from '@solana/wallet-adapter-react';
import { ConnectWallet } from './ConnectWallet';

export function AdminGate({ children }: { children: React.ReactNode }) {
  const { connected } = useWallet();
  if (!connected) {
    return (
      <div className="admin-gate">
        <p>Connect an admin wallet to moderate.</p>
        <ConnectWallet />
      </div>
    );
  }
  return <>{children}</>;
}
