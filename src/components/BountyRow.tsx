'use client';
import { useState } from 'react';
import type { Bounty } from '@/lib/types';
import { useSignedAction } from './useSignedAction';
import { postJson } from './postJson';
import { useVotes } from './VotesProvider';

export function BountyRow({ bounty, admin = false }: { bounty: Bounty; admin?: boolean }) {
  const { connected, sign } = useSignedAction();
  const { votes, setVote } = useVotes();
  const myVote = votes[bounty.id] ?? 0;
  const [count, setCount] = useState(bounty.votes_count);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [doneOpen, setDoneOpen] = useState(false);
  const [proof, setProof] = useState('');

  async function vote(dir: 'up' | 'down') {
    if (!connected) { setMsg('Connect your wallet first'); return; }
    setBusy(true); setMsg('');
    try {
      const signed = await sign('vote', bounty.id);
      const data = await postJson(`/api/bounties/${bounty.id}/vote`, { ...signed, dir });
      if (data.ok) {
        const d = data.data as { state: number; score: number };
        setVote(bounty.id, d.state);
        setCount(d.score);
      } else {
        setMsg(data.error ?? 'Error');
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function adminAction(kind: 'done' | 'delete', proofUrl?: string) {
    setBusy(true); setMsg('');
    try {
      // Admin actions are authorized by the session cookie (sent automatically),
      // not by a wallet signature.
      const payload =
        kind === 'done'
          ? { id: bounty.id, proof_url: proofUrl?.trim() || null }
          : { id: bounty.id };
      const data = await postJson(`/api/admin/${kind}`, payload);
      if (data.ok) location.reload();
      else setMsg(data.error ?? 'Error');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="row">
      <div className="vote">
        <button
          className={`arrow up${myVote === 1 ? ' active' : ''}`}
          onClick={() => vote('up')}
          disabled={busy}
          aria-label="upvote"
        >
          ▲
        </button>
        <span className="count">{count}</span>
        <button
          className={`arrow down${myVote === -1 ? ' active' : ''}`}
          onClick={() => vote('down')}
          disabled={busy}
          aria-label="downvote"
        >
          ▼
        </button>
      </div>
      <div className="row-body">
        <div className="row-title">{bounty.title}</div>
        <div className="row-desc">{bounty.description}</div>
        <div className="row-meta">
          reward {bounty.reward_sol} SOL · by {bounty.author_wallet.slice(0, 4)}…
          {bounty.author_wallet.slice(-2)} · {new Date(bounty.created_at).toLocaleDateString()}
        </div>
        {bounty.proof_url && (
          <a className="proof-link" href={bounty.proof_url} target="_blank" rel="noopener noreferrer">
            ↗ view proof
          </a>
        )}
        {admin && (
          <div className="admin-actions">
            {!doneOpen ? (
              <>
                <button onClick={() => setDoneOpen(true)} disabled={busy}>mark done</button>
                <button onClick={() => adminAction('delete')} disabled={busy}>delete</button>
              </>
            ) : (
              <div className="done-form">
                <input
                  className="input"
                  placeholder="proof link (optional) — https://…"
                  value={proof}
                  onChange={(e) => setProof(e.target.value)}
                />
                <div className="form-actions">
                  <button onClick={() => adminAction('done', proof)} disabled={busy}>confirm done</button>
                  <button onClick={() => { setDoneOpen(false); setProof(''); }} disabled={busy}>cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
        {msg && <div className="row-error">{msg}</div>}
      </div>
    </div>
  );
}
