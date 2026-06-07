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
   - `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` (admin login)
4. `npm run dev` — admin panel at `/admin` (in dev, login is `admin` / `admin`
   if `ADMIN_*` are unset).

## Rules enforced server-side
- Hold ≥ $10 of the token to propose or vote (balance × Jupiter price).
- One vote per wallet per bounty.
- 5 minutes between proposals per wallet.
- Admin moderation (mark done / delete) requires a valid admin login session
  (single shared account from env vars; demo `admin`/`admin` in dev only).

## Deploy (Vercel)
1. Push to GitHub (`nonodevsomecoin/bounty-board`).
2. Import the repo in Vercel.
3. Add all env vars from `.env.example` in Vercel Project Settings → Environment Variables.
4. Deploy. Add the custom `.xyz` domain in Settings → Domains.
