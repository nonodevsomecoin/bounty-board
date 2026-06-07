import { NextRequest, NextResponse } from 'next/server';
import { verifyIdentity } from '@/lib/auth/guard';
import { isAdmin } from '@/lib/db/admins';
import { markBountyDone } from '@/lib/db/bounties';
import { isBackendConfigured } from '@/lib/config';

export async function POST(req: NextRequest) {
  if (!isBackendConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'Preview mode — backend not configured yet.' },
      { status: 503 },
    );
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

  const guard = verifyIdentity(body, { action: 'done', resourceId: id });
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }
  if (!(await isAdmin(guard.wallet))) {
    return NextResponse.json({ ok: false, error: 'Not authorized' }, { status: 403 });
  }

  // Optional proof link (photo/video) attached when completing the bounty.
  const rawProof = body.proof_url;
  let proofUrl: string | null = null;
  if (rawProof !== undefined && rawProof !== null && rawProof !== '') {
    if (typeof rawProof !== 'string' || rawProof.length > 500 || !/^https?:\/\//i.test(rawProof.trim())) {
      return NextResponse.json({ ok: false, error: 'Proof must be a valid http(s) URL' }, { status: 400 });
    }
    proofUrl = rawProof.trim();
  }

  await markBountyDone(id, proofUrl);
  return NextResponse.json({ ok: true, data: { id, status: 'done', proof_url: proofUrl } });
}
