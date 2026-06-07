'use client';
import { postJson } from './postJson';

export function AdminLogout() {
  async function logout() {
    await postJson('/api/admin/logout', {});
    location.reload();
  }
  return (
    <button className="logout-btn" onClick={logout}>
      log out
    </button>
  );
}
