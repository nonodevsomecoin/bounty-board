# $TICKER Bounties

Community bounty board for a pump.fun memecoin. Token holders propose marketing
bounties and upvote them. Top 10 + Done pages. Admin moderation.

## Stack
Next.js (App Router, TS) · Supabase (Postgres) · Solana wallet (Phantom) ·
Jupiter price API · Vitest.

## Setup
1. `npm install`
2. Create a Supabase project; run `supabase/schema.sql` in its SQL editor.
3. Copy `.env.example` to `.env.local` and fill in:
   - Supabase URL + anon key + service-role key
   - `NEXT_PUBLIC_TOKEN_MINT` (the memecoin mint address)
   - `SOLANA_RPC_URL` and `NEXT_PUBLIC_SOLANA_RPC_URL`
4. Add admin wallets: `insert into admins (wallet) values ('<address>');`
5. `npm run dev`

## Rules enforced server-side
- Hold ≥ $10 of the token to propose or vote (balance × Jupiter price).
- One vote per wallet per bounty.
- 5 minutes between proposals per wallet.
- Only allow-listed wallets can mark done / delete.

## Deploy (Vercel)
1. Push to GitHub (`nonodevsomecoin/bounty-board`).
2. Import the repo in Vercel.
3. Add all env vars from `.env.example` in Vercel Project Settings → Environment Variables.
4. Deploy. Add the custom `.xyz` domain in Settings → Domains.
