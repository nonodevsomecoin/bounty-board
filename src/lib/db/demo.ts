import type { Bounty } from '@/lib/types';

// Sample bounties used ONLY when Supabase isn't configured, so the site can be
// previewed locally before a backend is wired up. Inert in production (env set).
const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString();

export const demoActiveBounties: Bounty[] = [
  {
    id: 'demo-1',
    title: 'Make a viral TikTok edit of the chart',
    description: 'Short, punchy edit set to a trending sound. Bonus for green candles.',
    reward_sol: 0.5,
    author_wallet: '7xKXq2aF9rPbN3uZ',
    status: 'active',
    created_at: hoursAgo(3),
    votes_count: 412,
  },
  {
    id: 'demo-2',
    title: 'Write a Twitter/X thread on the tokenomics',
    description: 'Clear, 6-8 tweet thread explaining supply, the bounty board, and why it matters.',
    reward_sol: 1,
    author_wallet: 'Bp9fK1mWqL2vX8tc',
    status: 'active',
    created_at: hoursAgo(6),
    votes_count: 288,
  },
  {
    id: 'demo-3',
    title: 'Design a sticker pack for Telegram',
    description: 'At least 8 stickers featuring the mascot. PNG with transparent background.',
    reward_sol: 0.3,
    author_wallet: 'Mq1aR7sD4hJ0nP5y',
    status: 'active',
    created_at: hoursAgo(26),
    votes_count: 154,
  },
  {
    id: 'demo-4',
    title: 'Shill in 5 relevant Telegram groups',
    description: 'Genuine, non-spammy messages. Screenshot proof of each post.',
    reward_sol: 0.2,
    author_wallet: 'Zc3bN8kT6wQ1eL9m',
    status: 'active',
    created_at: hoursAgo(40),
    votes_count: 97,
  },
];

export const demoDoneBounties: Bounty[] = [
  {
    id: 'demo-done-1',
    title: 'Create the launch announcement banner',
    description: 'Used across X and Telegram for launch day.',
    reward_sol: 0.4,
    author_wallet: 'Ad5fG2hJ8kL1qW3e',
    status: 'done',
    created_at: hoursAgo(120),
    votes_count: 203,
  },
];
