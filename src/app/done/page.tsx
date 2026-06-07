import { NavBar } from '@/components/NavBar';
import { BountyList } from '@/components/BountyList';
import { listDoneBounties } from '@/lib/db/bounties';

export const dynamic = 'force-dynamic';

export default async function DonePage() {
  const bounties = await listDoneBounties();
  return (
    <main className="page">
      <NavBar active="done" />
      <h1 className="page-title">Completed bounties</h1>
      <BountyList bounties={bounties} />
    </main>
  );
}
