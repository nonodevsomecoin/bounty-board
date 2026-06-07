import { NavBar } from '@/components/NavBar';
import { ProposeForm } from '@/components/ProposeForm';
import { BountyList } from '@/components/BountyList';
import { listActiveBounties } from '@/lib/db/bounties';

export const dynamic = 'force-dynamic';

export default async function BoardPage() {
  const bounties = await listActiveBounties();
  return (
    <main className="page">
      <NavBar active="board" />
      <ProposeForm />
      <BountyList bounties={bounties} />
    </main>
  );
}
