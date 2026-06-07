import Link from 'next/link';
import Image from 'next/image';
import { ConnectWallet } from './ConnectWallet';

export function NavBar({ active }: { active: 'board' | 'top' | 'done' }) {
  const link = (href: string, key: string, label: string) => (
    <Link href={href} className={active === key ? 'nav-link nav-active' : 'nav-link'}>
      {label}
    </Link>
  );
  return (
    <nav className="nav">
      <Link href="/" className="brand">
        <Image src="/logo.png" alt="Bounty-board" width={34} height={34} priority />
        <span className="brand-dim">/bounties</span>
      </Link>
      <div className="nav-right">
        {link('/', 'board', 'board')}
        {link('/top', 'top', 'top 10')}
        {link('/done', 'done', 'done')}
        <ConnectWallet />
      </div>
    </nav>
  );
}
