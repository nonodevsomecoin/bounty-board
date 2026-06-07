export type BountyStatus = 'active' | 'done';

export interface Bounty {
  id: string;
  title: string;
  description: string;
  reward_sol: number;
  author_wallet: string;
  status: BountyStatus;
  created_at: string;
  votes_count: number;
  proof_url: string | null;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
