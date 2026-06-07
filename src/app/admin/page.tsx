import { NavBar } from '@/components/NavBar';
import { BountyList } from '@/components/BountyList';
import { AdminLogin } from '@/components/AdminLogin';
import { AdminLogout } from '@/components/AdminLogout';
import { listActiveBounties } from '@/lib/db/bounties';
import { isAdminAuthenticated } from '@/lib/auth/adminSession.server';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const authed = await isAdminAuthenticated();
  const bounties = authed ? await listActiveBounties() : [];
  return (
    <main className="page">
      <NavBar active="board" />
      <div className="admin-head">
        <h1 className="page-title">Admin — moderation</h1>
        {authed && <AdminLogout />}
      </div>
      {authed ? <BountyList bounties={bounties} admin /> : <AdminLogin />}
    </main>
  );
}
