import { NextRequest, NextResponse } from 'next/server';
import { getUserVotes } from '@/lib/db/votes';
import { isDbConfigured } from '@/lib/config';

// Returns the connected wallet's current vote (-1/0/1) for the given bounty ids,
// so the UI can highlight the user's arrows. Vote data is public; no signature
// required for this read.
export async function POST(req: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ ok: true, data: { votes: {} } });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const wallet = typeof body.wallet === 'string' ? body.wallet : '';
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((x): x is string => typeof x === 'string')
    : [];
  if (!wallet || ids.length === 0) {
    return NextResponse.json({ ok: true, data: { votes: {} } });
  }
  const votes = await getUserVotes(wallet, ids);
  return NextResponse.json({ ok: true, data: { votes } });
}
