import type { Bounty } from '@/lib/types';
import { BountyRow } from './BountyRow';

export function BountyList({ bounties, admin = false }: { bounties: Bounty[]; admin?: boolean }) {
  if (bounties.length === 0) return <p className="empty">No bounties yet.</p>;
  return (
    <div className="list">
      {bounties.map((b) => (
        <BountyRow key={b.id} bounty={b} admin={admin} />
      ))}
    </div>
  );
}
