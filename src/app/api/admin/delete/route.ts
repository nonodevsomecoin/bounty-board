import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth/adminSession.server';
import { deleteBounty } from '@/lib/db/bounties';
import { isBackendConfigured } from '@/lib/config';

export async function POST(req: NextRequest) {
  if (!isBackendConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'Preview mode — backend not configured yet.' },
      { status: 503 },
    );
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

  const id = String(body.id ?? '');
  if (!id) {
    return NextResponse.json({ ok: false, error: 'Missing bounty id' }, { status: 400 });
  }

  await deleteBounty(id);
  return NextResponse.json({ ok: true, data: { id, deleted: true } });
}
