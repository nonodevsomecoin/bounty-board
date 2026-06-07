'use client';
import { useState } from 'react';
import { useSignedAction } from './useSignedAction';
import { postJson } from './postJson';

export function ProposeForm() {
  const { connected, sign } = useSignedAction();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reward, setReward] = useState('0');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!connected) { setMsg('Connect your wallet first'); return; }
    setBusy(true); setMsg('');
    try {
      const signed = await sign('propose');
      const data = await postJson('/api/bounties', {
        ...signed,
        title,
        description,
        reward_sol: Number(reward),
      });
      if (data.ok) location.reload();
      else setMsg(data.error ?? 'Error');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="prompt" onClick={() => setOpen(true)}>
        <span className="caret">&gt;</span> propose a bounty<span className="cursor">_</span>
      </button>
    );
  }
  return (
    <div className="form">
      <input className="input" placeholder="title" value={title}
        maxLength={140} onChange={(e) => setTitle(e.target.value)} />
      <textarea className="input" placeholder="description" value={description}
        maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
      <input className="input" type="number" min="0" step="0.1" placeholder="reward (SOL)"
        value={reward} onChange={(e) => setReward(e.target.value)} />
      <div className="form-actions">
        <button onClick={submit} disabled={busy}>post</button>
        <button onClick={() => setOpen(false)} disabled={busy}>cancel</button>
      </div>
      <div className="hint">hold ≥ $10 of the token to post · 5 min between posts</div>
      {msg && <div className="row-error">{msg}</div>}
    </div>
  );
}
