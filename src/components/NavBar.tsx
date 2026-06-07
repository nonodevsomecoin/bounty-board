import Link from 'next/link';
import { ConnectWallet } from './ConnectWallet';

export function NavBar({ active }: { active: 'board' | 'top' | 'done' }) {
  const link = (href: string, key: string, label: string) => (
    <Link href={href} className={active === key ? 'nav-link nav-active' : 'nav-link'}>
      {label}
    </Link>
  );
  return (
    <nav className="nav">
      <div className="brand">▮ $TICKER<span className="brand-dim">/bounties</span></div>
      <div className="nav-right">
        {link('/', 'board', 'board')}
        {link('/top', 'top', 'top 10')}
        {link('/done', 'done', 'done')}
        <ConnectWallet />
      </div>
    </nav>
  );
}
