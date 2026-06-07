'use client';
import { useState } from 'react';
import { postJson } from './postJson';

export function TokenConfig({ current }: { current: string | null }) {
  const [mint, setMint] = useState(current ?? '');
  const [saved, setSaved] = useState(current);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setMsg('');
    const data = await postJson('/api/admin/config', { token_mint: mint });
    if (data.ok) {
      const v = (data.data as { token_mint: string | null })?.token_mint ?? null;
      setSaved(v);
      setMsg(v ? 'Saved ✓ — proposals & voting are now LIVE.' : 'Cleared — proposals & voting are closed.');
    } else {
      setMsg(data.error ?? 'Error');
    }
    setBusy(false);
  }

  return (
    <div className="form token-config">
      <div className="label">Token mint address — activates proposals &amp; voting</div>
      <input
        className="input"
        placeholder="paste the pump.fun token address, then Save"
        value={mint}
        onChange={(e) => setMint(e.target.value)}
      />
      <div className="form-actions">
        <button onClick={save} disabled={busy}>save token</button>
      </div>
      <div className="hint">
        {saved
          ? `Status: LIVE (${saved.slice(0, 4)}…${saved.slice(-4)})`
          : 'Status: not set — proposals & voting are closed until you set this'}
      </div>
      {msg && <div className="row-meta" style={{ color: 'var(--green)' }}>{msg}</div>}
    </div>
  );
}
