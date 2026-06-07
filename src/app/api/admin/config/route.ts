import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth/adminSession.server';
import { isDbConfigured } from '@/lib/config';
import { setSetting } from '@/lib/db/settings';

// Base58, 32-44 chars — a Solana mint address.
const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function POST(req: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ ok: false, error: 'Backend not configured.' }, { status: 503 });
  }
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const raw = typeof body.token_mint === 'string' ? body.token_mint.trim() : '';
  if (raw && !MINT_RE.test(raw)) {
    return NextResponse.json(
      { ok: false, error: 'Invalid Solana token address' },
      { status: 400 },
    );
  }

  await setSetting('token_mint', raw || null);
  return NextResponse.json({ ok: true, data: { token_mint: raw || null } });
}
