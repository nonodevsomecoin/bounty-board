import { NavBar } from '@/components/NavBar';
import { BountyList } from '@/components/BountyList';
import { AdminGate } from '@/components/AdminGate';
import { listActiveBounties } from '@/lib/db/bounties';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const bounties = await listActiveBounties();
  return (
    <main className="page">
      <NavBar active="board" />
      <h1 className="page-title">Admin — moderation</h1>
      <AdminGate>
        <BountyList bounties={bounties} admin />
      </AdminGate>
    </main>
  );
}
