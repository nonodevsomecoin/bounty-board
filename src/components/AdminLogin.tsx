'use client';
import { useState } from 'react';
import { postJson } from './postJson';

export function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg('');
    try {
      const data = await postJson('/api/admin/login', { username, password });
      if (data.ok) location.reload();
      else setMsg(data.error ?? 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form login-form" onSubmit={submit}>
      <input
        className="input"
        placeholder="username"
        autoComplete="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <input
        className="input"
        type="password"
        placeholder="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <div className="form-actions">
        <button type="submit" disabled={busy}>log in</button>
      </div>
      {process.env.NODE_ENV !== 'production' && (
        <div className="hint">dev preview login: admin / admin</div>
      )}
      {msg && <div className="row-error">{msg}</div>}
    </form>
  );
}
