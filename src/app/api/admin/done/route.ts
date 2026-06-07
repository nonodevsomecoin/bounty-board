import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/auth/adminSession.server';
import { markBountyDone } from '@/lib/db/bounties';
import { isDbConfigured } from '@/lib/config';

export async function POST(req: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'Backend not configured.' },
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
