'use client';
import { useState } from 'react';
import type { Bounty } from '@/lib/types';
import { useSignedAction } from './useSignedAction';

export function BountyRow({ bounty, admin = false }: { bounty: Bounty; admin?: boolean }) {
  const { connected, sign } = useSignedAction();
  const [count, setCount] = useState(bounty.votes_count);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function vote() {
    if (!connected) { setMsg('Connect your wallet first'); return; }
    setBusy(true); setMsg('');
    try {
      const signed = await sign('vote', bounty.id);
      const res = await fetch(`/api/bounties/${bounty.id}/vote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(signed),
      });
      const data = await res.json();
      if (data.ok) setCount((c) => c + 1);
      else setMsg(data.error);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function adminAction(kind: 'done' | 'delete') {
    setBusy(true); setMsg('');
    try {
      const signed = await sign(kind, bounty.id);
      const res = await fetch(`/api/admin/${kind}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...signed, id: bounty.id }),
      });
      const data = await res.json();
      if (data.ok) location.reload();
      else setMsg(data.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="row">
      <button className="vote" onClick={vote} disabled={busy} aria-label="upvote">
        <span className="arrow">▲</span>
        <span className="count">{count}</span>
      </button>
      <div className="row-body">
        <div className="row-title">{bounty.title}</div>
        <div className="row-desc">{bounty.description}</div>
        <div className="row-meta">
          reward {bounty.reward_sol} SOL · by {bounty.author_wallet.slice(0, 4)}…
          {bounty.author_wallet.slice(-2)} · {new Date(bounty.created_at).toLocaleDateString()}
        </div>
        {admin && (
          <div className="admin-actions">
            <button onClick={() => adminAction('done')} disabled={busy}>mark done</button>
            <button onClick={() => adminAction('delete')} disabled={busy}>delete</button>
          </div>
        )}
        {msg && <div className="row-error">{msg}</div>}
      </div>
    </div>
  );
}
