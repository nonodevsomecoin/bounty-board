import { supabaseServer } from '@/lib/db/client';

export interface AddVoteResult {
  ok: boolean;
  duplicate: boolean;
}

export async function addVote(
  bountyId: string,
  wallet: string,
): Promise<AddVoteResult> {
  const { error } = await supabaseServer()
    .from('votes')
    .insert({ bounty_id: bountyId, wallet });
  if (!error) return { ok: true, duplicate: false };
  if (error.code === '23505') return { ok: false, duplicate: true };
  throw error;
}
