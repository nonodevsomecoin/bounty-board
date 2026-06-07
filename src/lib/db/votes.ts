import { supabaseServer } from '@/lib/db/client';

export type VoteState = -1 | 0 | 1;

export interface CastVoteResult {
  state: VoteState; // the wallet's vote after this action
  score: number;    // authoritative net score for the bounty
}

// Reddit-style net voting. One row per (bounty_id, wallet) holding value +1/-1.
// Clicking the same direction again removes the vote; the opposite switches it.
// The DB trigger keeps bounties.votes_count = sum(value) in sync.
export async function castVote(
  bountyId: string,
  wallet: string,
  value: 1 | -1,
): Promise<CastVoteResult> {
  const db = supabaseServer();

  const { data: existing, error: selErr } = await db
    .from('votes')
    .select('id, value')
    .eq('bounty_id', bountyId)
    .eq('wallet', wallet)
    .maybeSingle();
  if (selErr) throw selErr;

  let state: VoteState;
  if (!existing) {
    const { error } = await db.from('votes').insert({ bounty_id: bountyId, wallet, value });
    if (error) throw error;
    state = value;
  } else if ((existing.value as number) === value) {
    const { error } = await db.from('votes').delete().eq('id', existing.id);
    if (error) throw error;
    state = 0;
  } else {
    const { error } = await db.from('votes').update({ value }).eq('id', existing.id);
    if (error) throw error;
    state = value;
  }

  const { data: b, error: bErr } = await db
    .from('bounties')
    .select('votes_count')
    .eq('id', bountyId)
    .maybeSingle();
  if (bErr) throw bErr;

  return { state, score: (b?.votes_count as number) ?? 0 };
}

// The wallet's current vote (-1/0/1) for each of the given bounty ids.
export async function getUserVotes(
  wallet: string,
  ids: string[],
): Promise<Record<string, number>> {
  if (ids.length === 0) return {};
  const { data, error } = await supabaseServer()
    .from('votes')
    .select('bounty_id, value')
    .eq('wallet', wallet)
    .in('bounty_id', ids);
  if (error) return {};
  const out: Record<string, number> = {};
  for (const row of data ?? []) {
    out[row.bounty_id as string] = row.value as number;
  }
  return out;
}
