import { NextRequest, NextResponse } from 'next/server';
import { verifyHolder } from '@/lib/auth/guard';
import { addVote } from '@/lib/db/votes';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: bountyId } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const guard = await verifyHolder(body, { action: 'vote', resourceId: bountyId });
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }

  const result = await addVote(bountyId, guard.wallet);
  if (result.duplicate) {
    return NextResponse.json({ ok: false, error: 'You already voted on this bounty' }, { status: 409 });
  }
  return NextResponse.json({ ok: true, data: { voted: true } }, { status: 201 });
}
