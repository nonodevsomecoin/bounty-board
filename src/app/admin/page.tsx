import { NavBar } from '@/components/NavBar';
import { BountyList } from '@/components/BountyList';
import { AdminLogin } from '@/components/AdminLogin';
import { AdminLogout } from '@/components/AdminLogout';
import { TokenConfig } from '@/components/TokenConfig';
import { listActiveBounties } from '@/lib/db/bounties';
import { getSetting } from '@/lib/db/settings';
import { isAdminAuthenticated } from '@/lib/auth/adminSession.server';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const authed = await isAdminAuthenticated();
  const [bounties, tokenMint] = authed
    ? await Promise.all([listActiveBounties(), getSetting('token_mint')])
    : [[], null];
  return (
    <main className="page">
      <NavBar active="board" />
      <div className="admin-head">
        <h1 className="page-title">Admin — moderation</h1>
        {authed && <AdminLogout />}
      </div>
      {authed ? (
        <>
          <TokenConfig current={tokenMint} />
          <BountyList bounties={bounties} admin />
        </>
      ) : (
        <AdminLogin />
      )}
    </main>
  );
}
