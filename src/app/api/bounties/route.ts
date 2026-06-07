import { NextRequest, NextResponse } from 'next/server';
import { verifyHolder } from '@/lib/auth/guard';
import { getLastProposalMs, insertBounty } from '@/lib/db/bounties';
import { checkCooldown } from '@/lib/cooldown';
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

  const guard = await verifyHolder(body, { action: 'propose' });
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }

  const title = String(body.title ?? '').trim();
  const description = String(body.description ?? '').trim();
  const reward_sol = Number(body.reward_sol);
  if (!title || title.length > 140) {
    return NextResponse.json({ ok: false, error: 'Title is required (max 140 chars)' }, { status: 400 });
  }
  if (!description || description.length > 2000) {
    return NextResponse.json({ ok: false, error: 'Description is required (max 2000 chars)' }, { status: 400 });
  }
  if (!Number.isFinite(reward_sol) || reward_sol < 0) {
    return NextResponse.json({ ok: false, error: 'Reward must be a non-negative number' }, { status: 400 });
  }

  const last = await getLastProposalMs(guard.wallet);
  const cd = checkCooldown(last, Date.now());
  if (!cd.allowed) {
    const mins = Math.ceil(cd.remainingMs / 60000);
    return NextResponse.json(
      { ok: false, error: `Please wait ${mins} more minute(s) before posting again` },
      { status: 429 },
    );
  }

  const bounty = await insertBounty({
    title,
    description,
    reward_sol,
    author_wallet: guard.wallet,
  });
  return NextResponse.json({ ok: true, data: bounty }, { status: 201 });
}
