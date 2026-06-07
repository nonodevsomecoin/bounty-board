import { supabaseAnon, supabaseServer } from '@/lib/db/client';
import type { Bounty } from '@/lib/types';

export async function listActiveBounties(): Promise<Bounty[]> {
  const { data, error } = await supabaseAnon()
    .from('bounties')
    .select('*')
    .eq('status', 'active')
    .order('votes_count', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Bounty[];
}

export async function topBounties(limit = 10): Promise<Bounty[]> {
  const { data, error } = await supabaseAnon()
    .from('bounties')
    .select('*')
    .eq('status', 'active')
    .order('votes_count', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Bounty[];
}

export async function listDoneBounties(): Promise<Bounty[]> {
  const { data, error } = await supabaseAnon()
    .from('bounties')
    .select('*')
    .eq('status', 'done')
    .order('votes_count', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Bounty[];
}

export async function getLastProposalMs(wallet: string): Promise<number | null> {
  const { data, error } = await supabaseServer()
    .from('bounties')
    .select('created_at')
    .eq('author_wallet', wallet)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) return null;
  return new Date(data[0].created_at as string).getTime();
}

export async function insertBounty(input: {
  title: string;
  description: string;
  reward_sol: number;
  author_wallet: string;
}): Promise<Bounty> {
  const { data, error } = await supabaseServer()
    .from('bounties')
    .insert({ ...input, status: 'active' })
    .select('*')
    .single();
  if (error) throw error;
  return data as Bounty;
}

export async function markBountyDone(id: string): Promise<void> {
  const { error } = await supabaseServer()
    .from('bounties')
    .update({ status: 'done' })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteBounty(id: string): Promise<void> {
  const { error } = await supabaseServer().from('bounties').delete().eq('id', id);
  if (error) throw error;
}
