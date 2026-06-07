import { NavBar } from '@/components/NavBar';
import { BountyList } from '@/components/BountyList';
import { topBounties } from '@/lib/db/bounties';

export const dynamic = 'force-dynamic';

export default async function TopPage() {
  const bounties = await topBounties(10);
  return (
    <main className="page">
      <NavBar active="top" />
      <h1 className="page-title">Top 10 bounties</h1>
      <BountyList bounties={bounties} />
    </main>
  );
}
