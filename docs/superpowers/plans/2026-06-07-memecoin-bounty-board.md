# Memecoin Bounty Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a community bounty board, linked to a pump.fun memecoin, where token holders propose marketing bounties and upvote them (Reddit-style), with Top 10 and Done pages and an admin panel.

**Architecture:** Single Next.js (App Router, TypeScript) app. Public pages are Server Components that read from Supabase (Postgres) with the anon key. All sensitive writes (propose, vote, moderate) go through Next.js API routes that run server-side checks: wallet signature verification, a ≥ $10 token-holding threshold (on-chain balance × Jupiter price), a 5-minute proposal cooldown, and admin allow-listing. Deployed on Vercel.

**Tech Stack:** Next.js 14+ (App Router) · TypeScript · Supabase (Postgres) · `@solana/web3.js` · `@solana/wallet-adapter-*` (Phantom) · `tweetnacl` + `bs58` (signature verification) · Jupiter Price API · Vitest (tests).

---

## Scope Note

This is one cohesive subsystem (a single web app) and is implemented as a single plan. The spec it implements lives at `docs/superpowers/specs/2026-06-07-memecoin-bounty-board-design.md`.

## File Structure

```
src/
  lib/
    config.ts                  # env reads + constants (MIN_USD, COOLDOWN_MS, mint, rpc)
    auth/
      signature.ts             # verifySignature, extractTimestamp, isTimestampFresh, buildMessage
    solana/
      tokenBalance.ts          # getTokenBalance(rpcUrl, wallet, mint) -> UI amount
    price/
      jupiterPrice.ts          # getTokenPriceUsd(mint) -> number
    eligibility.ts             # checkEligibility(balance, price) + getWalletUsdValue(deps)
    cooldown.ts                # checkCooldown(lastMs, nowMs)
    db/
      client.ts                # supabaseServer() (service role), supabaseAnon()
      bounties.ts              # list/insert/top/done/markDone/delete/getLastProposalAt
      votes.ts                 # addVote
      admins.ts                # isAdmin
    types.ts                   # Bounty type, ApiResult helpers
  app/
    layout.tsx                 # root layout, wallet provider, global styles
    globals.css                # terminal-dark theme
    providers.tsx              # client wallet-adapter provider
    page.tsx                   # Board (/)
    top/page.tsx               # Top 10 (/top)
    done/page.tsx              # Done (/done)
    admin/page.tsx             # Admin (/admin)
    api/
      bounties/route.ts        # POST propose
      bounties/[id]/vote/route.ts   # POST vote
      admin/done/route.ts      # POST mark done
      admin/delete/route.ts    # POST delete
  components/
    ConnectWallet.tsx          # connect button (client)
    BountyList.tsx             # renders rows
    BountyRow.tsx              # one row + upvote button (client)
    ProposeForm.tsx            # propose modal/form (client)
    useSignedAction.ts         # client hook: build message + sign
supabase/
  schema.sql                   # tables, constraints, trigger, RLS
tests/
  auth.signature.test.ts
  eligibility.test.ts
  cooldown.test.ts
  tokenBalance.test.ts
  jupiterPrice.test.ts
.env.example
README.md
vitest.config.ts
```

**Shared types (defined once in `src/lib/types.ts`, used everywhere):**

```typescript
export type BountyStatus = 'active' | 'done';

export interface Bounty {
  id: string;
  title: string;
  description: string;
  reward_sol: number;
  author_wallet: string;
  status: BountyStatus;
  created_at: string; // ISO string
  votes_count: number;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
```

---

## Task 1: Initialize the Next.js + TypeScript project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Scaffold the app**

Run in the project root (the dir already contains `.git`, `docs/`, `.gitignore`):

```bash
npx create-next-app@latest . --typescript --app --src-dir --eslint --no-tailwind --import-alias "@/*" --use-npm
```

When prompted that the directory is not empty, keep existing files. (`create-next-app` preserves `.git`, `docs/`, `.gitignore`.)

- [ ] **Step 2: Verify it runs**

Run: `npm run dev`
Expected: dev server starts on `http://localhost:3000` with no errors. Stop it with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app"
```

---

## Task 2: Set up Vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (add `test` script + dev deps)

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

- [ ] **Step 3: Add the test script to `package.json`**

In the `"scripts"` block add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify Vitest finds no tests yet (clean exit)**

Run: `npm test`
Expected: "No test files found" (exit 0) — confirms config loads.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: add Vitest"
```

---

## Task 3: Database schema (Supabase)

**Files:**
- Create: `supabase/schema.sql`

- [ ] **Step 1: Write the schema**

```sql
-- supabase/schema.sql
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor) once.

create extension if not exists "pgcrypto";

create table if not exists bounties (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 1 and 140),
  description   text not null check (char_length(description) between 1 and 2000),
  reward_sol    numeric not null check (reward_sol >= 0),
  author_wallet text not null,
  status        text not null default 'active' check (status in ('active','done')),
  created_at    timestamptz not null default now(),
  votes_count   int not null default 0
);

create table if not exists votes (
  id         uuid primary key default gen_random_uuid(),
  bounty_id  uuid not null references bounties(id) on delete cascade,
  wallet     text not null,
  created_at timestamptz not null default now(),
  unique (bounty_id, wallet)
);

create table if not exists admins (
  wallet text primary key
);

-- Keep votes_count in sync automatically.
create or replace function bump_votes_count() returns trigger as $$
begin
  update bounties set votes_count = votes_count + 1 where id = new.bounty_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_bump_votes on votes;
create trigger trg_bump_votes after insert on votes
  for each row execute function bump_votes_count();

-- Row Level Security: public can read, only the service role can write.
alter table bounties enable row level security;
alter table votes    enable row level security;
alter table admins   enable row level security;

drop policy if exists "public read bounties" on bounties;
create policy "public read bounties" on bounties for select using (true);

drop policy if exists "public read done votes count" on votes;
create policy "public read votes" on votes for select using (true);
-- No insert/update/delete policies => only the service-role key (which bypasses
-- RLS) can write. All writes go through our API routes.

-- Useful index for the board ordering.
create index if not exists idx_bounties_active_votes
  on bounties (votes_count desc) where status = 'active';
```

- [ ] **Step 2: Apply it**

In the Supabase dashboard, open SQL Editor, paste the file contents, run. Verify the three tables appear under Table Editor. (No automated test — this is a one-time manual migration. Record the project URL + keys for Task 10.)

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: database schema (bounties, votes, admins)"
```

---

## Task 4: Config + shared types

**Files:**
- Create: `src/lib/config.ts`, `src/lib/types.ts`

- [ ] **Step 1: Write `src/lib/types.ts`**

```typescript
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
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
```

- [ ] **Step 2: Write `src/lib/config.ts`**

```typescript
// Server-side env reads + tunable constants.
export const MIN_USD = 10;                 // holding threshold to post/vote
export const COOLDOWN_MS = 5 * 60 * 1000;  // 5 minutes between proposals
export const SIGNATURE_MAX_SKEW_MS = 2 * 60 * 1000; // signed message freshness

export const TOKEN_MINT = process.env.NEXT_PUBLIC_TOKEN_MINT ?? '';
export const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/config.ts src/lib/types.ts
git commit -m "feat: config and shared types"
```

---

## Task 5: Signature verification (TDD)

**Files:**
- Create: `src/lib/auth/signature.ts`
- Test: `tests/auth.signature.test.ts`

- [ ] **Step 1: Install crypto deps**

```bash
npm install tweetnacl bs58
```

- [ ] **Step 2: Write the failing test**

```typescript
// tests/auth.signature.test.ts
import { describe, it, expect } from 'vitest';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import {
  verifySignature,
  buildMessage,
  extractTimestamp,
  isTimestampFresh,
} from '@/lib/auth/signature';

function signAs(message: string) {
  const kp = nacl.sign.keyPair();
  const sig = nacl.sign.detached(new TextEncoder().encode(message), kp.secretKey);
  return {
    wallet: bs58.encode(kp.publicKey),
    signature: bs58.encode(sig),
  };
}

describe('verifySignature', () => {
  it('accepts a valid signature', () => {
    const msg = 'hello';
    const { wallet, signature } = signAs(msg);
    expect(verifySignature(wallet, msg, signature)).toBe(true);
  });

  it('rejects a tampered message', () => {
    const { wallet, signature } = signAs('hello');
    expect(verifySignature(wallet, 'goodbye', signature)).toBe(false);
  });

  it('rejects a signature from a different wallet', () => {
    const { signature } = signAs('hello');
    const other = signAs('hello');
    expect(verifySignature(other.wallet, 'hello', signature)).toBe(false);
  });

  it('returns false on malformed input instead of throwing', () => {
    expect(verifySignature('not-base58!!', 'm', 'also-bad')).toBe(false);
  });
});

describe('message helpers', () => {
  it('builds a message containing the action and timestamp', () => {
    const msg = buildMessage('vote', 1000);
    expect(msg).toContain('vote');
    expect(extractTimestamp(msg)).toBe(1000);
  });

  it('extractTimestamp returns null when absent', () => {
    expect(extractTimestamp('no timestamp here')).toBeNull();
  });

  it('isTimestampFresh true within skew, false outside', () => {
    expect(isTimestampFresh(1000, 1000 + 60_000)).toBe(true);
    expect(isTimestampFresh(1000, 1000 + 5 * 60_000)).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- tests/auth.signature.test.ts`
Expected: FAIL — module `@/lib/auth/signature` not found.

- [ ] **Step 4: Write the implementation**

```typescript
// src/lib/auth/signature.ts
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { SIGNATURE_MAX_SKEW_MS } from '@/lib/config';

export function buildMessage(action: string, timestampMs: number): string {
  return [
    `$TICKER Bounties — proving wallet ownership to ${action}.`,
    `Timestamp: ${timestampMs}`,
  ].join('\n');
}

export function extractTimestamp(message: string): number | null {
  const m = message.match(/Timestamp:\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

export function isTimestampFresh(
  timestampMs: number,
  nowMs: number,
  maxSkewMs: number = SIGNATURE_MAX_SKEW_MS,
): boolean {
  return Math.abs(nowMs - timestampMs) <= maxSkewMs;
}

export function verifySignature(
  walletBase58: string,
  message: string,
  signatureBase58: string,
): boolean {
  try {
    const pub = bs58.decode(walletBase58);
    const sig = bs58.decode(signatureBase58);
    const msg = new TextEncoder().encode(message);
    return nacl.sign.detached.verify(msg, sig, pub);
  } catch {
    return false;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/auth.signature.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/signature.ts tests/auth.signature.test.ts package.json package-lock.json
git commit -m "feat: wallet signature verification with freshness check"
```

---

## Task 6: Eligibility threshold logic (TDD)

**Files:**
- Create: `src/lib/eligibility.ts`
- Test: `tests/eligibility.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/eligibility.test.ts
import { describe, it, expect, vi } from 'vitest';
import { checkEligibility, getWalletUsdValue } from '@/lib/eligibility';

describe('checkEligibility', () => {
  it('eligible when balance*price >= MIN_USD (10)', () => {
    const r = checkEligibility(100, 0.2); // $20
    expect(r.eligible).toBe(true);
    expect(r.usdValue).toBe(20);
  });

  it('not eligible below threshold', () => {
    const r = checkEligibility(10, 0.5); // $5
    expect(r.eligible).toBe(false);
    expect(r.usdValue).toBe(5);
  });

  it('exactly $10 is eligible', () => {
    expect(checkEligibility(40, 0.25).eligible).toBe(true); // $10
  });
});

describe('getWalletUsdValue', () => {
  it('multiplies fetched balance by fetched price', async () => {
    const deps = {
      getBalance: vi.fn().mockResolvedValue(50),
      getPrice: vi.fn().mockResolvedValue(0.4),
    };
    const usd = await getWalletUsdValue('WALLET', deps);
    expect(usd).toBe(20);
    expect(deps.getBalance).toHaveBeenCalledWith('WALLET');
    expect(deps.getPrice).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/eligibility.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/eligibility.ts
import { MIN_USD } from '@/lib/config';

export interface EligibilityResult {
  eligible: boolean;
  usdValue: number;
}

export function checkEligibility(
  balanceTokens: number,
  priceUsd: number,
  minUsd: number = MIN_USD,
): EligibilityResult {
  const usdValue = balanceTokens * priceUsd;
  return { eligible: usdValue >= minUsd, usdValue };
}

export interface UsdValueDeps {
  getBalance: (wallet: string) => Promise<number>;
  getPrice: () => Promise<number>;
}

export async function getWalletUsdValue(
  wallet: string,
  deps: UsdValueDeps,
): Promise<number> {
  const [balance, price] = await Promise.all([
    deps.getBalance(wallet),
    deps.getPrice(),
  ]);
  return balance * price;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/eligibility.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/eligibility.ts tests/eligibility.test.ts
git commit -m "feat: $10 holding eligibility logic"
```

---

## Task 7: Proposal cooldown logic (TDD)

**Files:**
- Create: `src/lib/cooldown.ts`
- Test: `tests/cooldown.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/cooldown.test.ts
import { describe, it, expect } from 'vitest';
import { checkCooldown } from '@/lib/cooldown';

const FIVE_MIN = 5 * 60 * 1000;

describe('checkCooldown', () => {
  it('allows when there is no prior proposal', () => {
    const r = checkCooldown(null, 1_000_000);
    expect(r.allowed).toBe(true);
    expect(r.remainingMs).toBe(0);
  });

  it('blocks within the cooldown window and reports remaining', () => {
    const last = 1_000_000;
    const now = last + 60_000; // 1 min later
    const r = checkCooldown(last, now);
    expect(r.allowed).toBe(false);
    expect(r.remainingMs).toBe(FIVE_MIN - 60_000);
  });

  it('allows exactly at the boundary', () => {
    const last = 1_000_000;
    const r = checkCooldown(last, last + FIVE_MIN);
    expect(r.allowed).toBe(true);
    expect(r.remainingMs).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/cooldown.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/cooldown.ts
import { COOLDOWN_MS } from '@/lib/config';

export interface CooldownResult {
  allowed: boolean;
  remainingMs: number;
}

export function checkCooldown(
  lastProposalMs: number | null,
  nowMs: number,
  cooldownMs: number = COOLDOWN_MS,
): CooldownResult {
  if (lastProposalMs === null) return { allowed: true, remainingMs: 0 };
  const elapsed = nowMs - lastProposalMs;
  if (elapsed >= cooldownMs) return { allowed: true, remainingMs: 0 };
  return { allowed: false, remainingMs: cooldownMs - elapsed };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/cooldown.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/cooldown.ts tests/cooldown.test.ts
git commit -m "feat: 5-minute proposal cooldown logic"
```

---

## Task 8: Token balance adapter (TDD with injected connection)

**Files:**
- Create: `src/lib/solana/tokenBalance.ts`
- Test: `tests/tokenBalance.test.ts`

- [ ] **Step 1: Install web3.js**

```bash
npm install @solana/web3.js
```

- [ ] **Step 2: Write the failing test**

The function takes a minimal `connection`-like object so it can be tested without a network. It sums the UI amounts across the wallet's token accounts for the mint.

```typescript
// tests/tokenBalance.test.ts
import { describe, it, expect, vi } from 'vitest';
import { sumTokenUiAmount } from '@/lib/solana/tokenBalance';

describe('sumTokenUiAmount', () => {
  it('sums uiAmount across parsed token accounts', () => {
    const parsed = {
      value: [
        { account: { data: { parsed: { info: { tokenAmount: { uiAmount: 12.5 } } } } } },
        { account: { data: { parsed: { info: { tokenAmount: { uiAmount: 7.5 } } } } } },
      ],
    };
    expect(sumTokenUiAmount(parsed)).toBe(20);
  });

  it('returns 0 when there are no accounts', () => {
    expect(sumTokenUiAmount({ value: [] })).toBe(0);
  });

  it('treats null uiAmount as 0', () => {
    const parsed = {
      value: [
        { account: { data: { parsed: { info: { tokenAmount: { uiAmount: null } } } } } },
      ],
    };
    expect(sumTokenUiAmount(parsed)).toBe(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- tests/tokenBalance.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write the implementation**

```typescript
// src/lib/solana/tokenBalance.ts
import { Connection, PublicKey } from '@solana/web3.js';

const TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
);

interface ParsedTokenAccounts {
  value: Array<{
    account: { data: { parsed: { info: { tokenAmount: { uiAmount: number | null } } } } };
  }>;
}

// Pure, testable: sum uiAmount across a wallet's token accounts.
export function sumTokenUiAmount(parsed: ParsedTokenAccounts): number {
  return parsed.value.reduce((acc, a) => {
    const ui = a.account.data.parsed.info.tokenAmount.uiAmount;
    return acc + (ui ?? 0);
  }, 0);
}

// Network call: fetch the wallet's token accounts for the mint and sum them.
export async function getTokenBalance(
  rpcUrl: string,
  wallet: string,
  mint: string,
): Promise<number> {
  const connection = new Connection(rpcUrl, 'confirmed');
  const owner = new PublicKey(wallet);
  const res = await connection.getParsedTokenAccountsByOwner(owner, {
    mint: new PublicKey(mint),
    programId: TOKEN_PROGRAM_ID,
  });
  return sumTokenUiAmount(res as unknown as ParsedTokenAccounts);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/tokenBalance.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/solana/tokenBalance.ts tests/tokenBalance.test.ts package.json package-lock.json
git commit -m "feat: SPL token balance adapter"
```

---

## Task 9: Jupiter price adapter (TDD with injected fetch)

**Files:**
- Create: `src/lib/price/jupiterPrice.ts`
- Test: `tests/jupiterPrice.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/jupiterPrice.test.ts
import { describe, it, expect, vi } from 'vitest';
import { getTokenPriceUsd } from '@/lib/price/jupiterPrice';

function fakeFetch(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe('getTokenPriceUsd', () => {
  it('parses the price for the mint', async () => {
    const mint = 'MINT123';
    const fetchImpl = fakeFetch({ data: { MINT123: { price: 0.37 } } });
    const price = await getTokenPriceUsd(mint, fetchImpl);
    expect(price).toBe(0.37);
  });

  it('returns 0 when the mint is absent from the response', async () => {
    const fetchImpl = fakeFetch({ data: {} });
    expect(await getTokenPriceUsd('NOPE', fetchImpl)).toBe(0);
  });

  it('returns 0 on a non-ok response', async () => {
    const fetchImpl = fakeFetch({}, false);
    expect(await getTokenPriceUsd('X', fetchImpl)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/jupiterPrice.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/price/jupiterPrice.ts
import { TOKEN_MINT } from '@/lib/config';

// Jupiter Lite price API: https://lite-api.jup.ag/price/v2?ids=<mint>
const JUP_URL = 'https://lite-api.jup.ag/price/v2';

export async function getTokenPriceUsd(
  mint: string = TOKEN_MINT,
  fetchImpl: typeof fetch = fetch,
): Promise<number> {
  try {
    const res = await fetchImpl(`${JUP_URL}?ids=${mint}`);
    if (!res.ok) return 0;
    const body = (await res.json()) as { data?: Record<string, { price?: number }> };
    const price = body.data?.[mint]?.price;
    return typeof price === 'number' ? price : 0;
  } catch {
    return 0;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/jupiterPrice.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/price/jupiterPrice.ts tests/jupiterPrice.test.ts
git commit -m "feat: Jupiter price adapter"
```

---

## Task 10: Supabase clients

**Files:**
- Create: `src/lib/db/client.ts`, `.env.example`
- Modify: `.env.local` (local, untracked)

- [ ] **Step 1: Install the Supabase client**

```bash
npm install @supabase/supabase-js
```

- [ ] **Step 2: Write `.env.example`**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Solana
NEXT_PUBLIC_TOKEN_MINT=YourTokenMintAddress
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

- [ ] **Step 3: Create `.env.local`** (copy of `.env.example` with the real values from your Supabase project + token mint). This file is git-ignored.

- [ ] **Step 4: Write `src/lib/db/client.ts`**

```typescript
import { createClient } from '@supabase/supabase-js';
import { requireEnv } from '@/lib/config';

// Read-only public client (anon key) — used by Server Components.
export function supabaseAnon() {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    { auth: { persistSession: false } },
  );
}

// Privileged client (service role) — used ONLY in API routes. Bypasses RLS.
export function supabaseServer() {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/client.ts .env.example package.json package-lock.json
git commit -m "feat: Supabase clients (anon + service role)"
```

---

## Task 11: Bounties data access

**Files:**
- Create: `src/lib/db/bounties.ts`

No unit test (thin Supabase wrapper; covered via API-route manual verification in Task 16). Keep functions small and named exactly as below — later tasks call them.

- [ ] **Step 1: Write `src/lib/db/bounties.ts`**

```typescript
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/bounties.ts
git commit -m "feat: bounties data access"
```

---

## Task 12: Votes + admins data access

**Files:**
- Create: `src/lib/db/votes.ts`, `src/lib/db/admins.ts`

- [ ] **Step 1: Write `src/lib/db/votes.ts`**

`addVote` relies on the DB unique constraint `(bounty_id, wallet)`. A duplicate insert raises Postgres error code `23505`, which we translate into `{ ok: false, duplicate: true }` rather than throwing.

```typescript
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
```

- [ ] **Step 2: Write `src/lib/db/admins.ts`**

```typescript
import { supabaseServer } from '@/lib/db/client';

export async function isAdmin(wallet: string): Promise<boolean> {
  const { data, error } = await supabaseServer()
    .from('admins')
    .select('wallet')
    .eq('wallet', wallet)
    .limit(1);
  if (error) throw error;
  return !!data && data.length > 0;
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/votes.ts src/lib/db/admins.ts
git commit -m "feat: votes and admins data access"
```

---

## Task 13: Shared API auth guard

**Files:**
- Create: `src/lib/auth/guard.ts`

A single helper used by every write route: parse `{ wallet, message, signature }`, verify the signature, verify timestamp freshness, and (for non-admin actions) verify the $10 holding. Returns a discriminated result so routes stay tiny.

- [ ] **Step 1: Write `src/lib/auth/guard.ts`**

```typescript
import { verifySignature, extractTimestamp, isTimestampFresh } from '@/lib/auth/signature';
import { getWalletUsdValue, checkEligibility } from '@/lib/eligibility';
import { getTokenBalance } from '@/lib/solana/tokenBalance';
import { getTokenPriceUsd } from '@/lib/price/jupiterPrice';
import { SOLANA_RPC_URL, TOKEN_MINT } from '@/lib/config';

export interface SignedBody {
  wallet?: unknown;
  message?: unknown;
  signature?: unknown;
}

export type GuardResult =
  | { ok: true; wallet: string }
  | { ok: false; status: number; error: string };

// Verifies signature + freshness. Does NOT check holdings.
export function verifyIdentity(body: SignedBody, nowMs = Date.now()): GuardResult {
  const { wallet, message, signature } = body;
  if (typeof wallet !== 'string' || typeof message !== 'string' || typeof signature !== 'string') {
    return { ok: false, status: 400, error: 'Missing wallet, message, or signature' };
  }
  if (!verifySignature(wallet, message, signature)) {
    return { ok: false, status: 401, error: 'Invalid signature' };
  }
  const ts = extractTimestamp(message);
  if (ts === null || !isTimestampFresh(ts, nowMs)) {
    return { ok: false, status: 401, error: 'Signature expired, please retry' };
  }
  return { ok: true, wallet };
}

// Verifies identity AND the $10 holding threshold.
export async function verifyHolder(body: SignedBody, nowMs = Date.now()): Promise<GuardResult> {
  const id = verifyIdentity(body, nowMs);
  if (!id.ok) return id;
  const usd = await getWalletUsdValue(id.wallet, {
    getBalance: (w) => getTokenBalance(SOLANA_RPC_URL, w, TOKEN_MINT),
    getPrice: () => getTokenPriceUsd(TOKEN_MINT),
  });
  if (!checkEligibility(usd, 1).eligible) {
    return { ok: false, status: 403, error: 'You must hold at least $10 of the token' };
  }
  return { ok: true, wallet: id.wallet };
}
```

Note: `getWalletUsdValue` already returns the USD value, so we call `checkEligibility(usd, 1)` to compare `usd * 1 >= 10`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/guard.ts
git commit -m "feat: shared API auth guard (identity + holder)"
```

---

## Task 14: API route — propose a bounty

**Files:**
- Create: `src/app/api/bounties/route.ts`

- [ ] **Step 1: Write the route**

```typescript
// src/app/api/bounties/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyHolder } from '@/lib/auth/guard';
import { getLastProposalMs, insertBounty } from '@/lib/db/bounties';
import { checkCooldown } from '@/lib/cooldown';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const guard = await verifyHolder(body);
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/bounties/route.ts
git commit -m "feat: POST /api/bounties (propose)"
```

---

## Task 15: API route — vote

**Files:**
- Create: `src/app/api/bounties/[id]/vote/route.ts`

- [ ] **Step 1: Write the route**

```typescript
// src/app/api/bounties/[id]/vote/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyHolder } from '@/lib/auth/guard';
import { addVote } from '@/lib/db/votes';

export async function POST(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  const bountyId = ctx.params.id;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const guard = await verifyHolder(body);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }

  const result = await addVote(bountyId, guard.wallet);
  if (result.duplicate) {
    return NextResponse.json({ ok: false, error: 'You already voted on this bounty' }, { status: 409 });
  }
  return NextResponse.json({ ok: true, data: { voted: true } }, { status: 201 });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/bounties/[id]/vote/route.ts"
git commit -m "feat: POST /api/bounties/[id]/vote"
```

---

## Task 16: API routes — admin (mark done, delete)

**Files:**
- Create: `src/app/api/admin/done/route.ts`, `src/app/api/admin/delete/route.ts`

- [ ] **Step 1: Write `src/app/api/admin/done/route.ts`**

```typescript
// src/app/api/admin/done/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyIdentity } from '@/lib/auth/guard';
import { isAdmin } from '@/lib/db/admins';
import { markBountyDone } from '@/lib/db/bounties';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const guard = verifyIdentity(body);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }
  if (!(await isAdmin(guard.wallet))) {
    return NextResponse.json({ ok: false, error: 'Not authorized' }, { status: 403 });
  }

  const id = String(body.id ?? '');
  if (!id) {
    return NextResponse.json({ ok: false, error: 'Missing bounty id' }, { status: 400 });
  }
  await markBountyDone(id);
  return NextResponse.json({ ok: true, data: { id, status: 'done' } });
}
```

- [ ] **Step 2: Write `src/app/api/admin/delete/route.ts`**

```typescript
// src/app/api/admin/delete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyIdentity } from '@/lib/auth/guard';
import { isAdmin } from '@/lib/db/admins';
import { deleteBounty } from '@/lib/db/bounties';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const guard = verifyIdentity(body);
  if (!guard.ok) {
    return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }
  if (!(await isAdmin(guard.wallet))) {
    return NextResponse.json({ ok: false, error: 'Not authorized' }, { status: 403 });
  }

  const id = String(body.id ?? '');
  if (!id) {
    return NextResponse.json({ ok: false, error: 'Missing bounty id' }, { status: 400 });
  }
  await deleteBounty(id);
  return NextResponse.json({ ok: true, data: { id, deleted: true } });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual API smoke test**

Add a temporary admin row in Supabase (`insert into admins (wallet) values ('<your wallet>')`). Start `npm run dev`. From the browser console on `localhost:3000`, run the snippet below (it connects Phantom, signs, and posts a bounty). Replace nothing — it reads the live wallet:

```javascript
const ts = Date.now();
const message = `$TICKER Bounties — proving wallet ownership to propose.\nTimestamp: ${ts}`;
const { publicKey, signMessage } = window.solana;
await window.solana.connect();
const sigBytes = await signMessage(new TextEncoder().encode(message));
const bs58 = (await import('https://esm.sh/bs58')).default;
const res = await fetch('/api/bounties', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    wallet: window.solana.publicKey.toBase58(),
    message,
    signature: bs58.encode(sigBytes.signature ?? sigBytes),
    title: 'Test bounty',
    description: 'Hello from smoke test',
    reward_sol: 0.1,
  }),
});
console.log(await res.json());
```

Expected: `{ ok: true, data: {...} }` if the wallet holds ≥ $10; otherwise the `403` holding message. Confirms the full propose path works.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/
git commit -m "feat: admin API routes (mark done, delete)"
```

---

## Task 17: Client wallet provider + signing hook

**Files:**
- Create: `src/app/providers.tsx`, `src/components/ConnectWallet.tsx`, `src/components/useSignedAction.ts`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Install wallet adapter**

```bash
npm install @solana/wallet-adapter-base @solana/wallet-adapter-react @solana/wallet-adapter-react-ui @solana/wallet-adapter-wallets
```

- [ ] **Step 2: Write `src/app/providers.tsx`**

```tsx
'use client';
import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import '@solana/wallet-adapter-react-ui/styles.css';

export function Providers({ children }: { children: React.ReactNode }) {
  const endpoint =
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
```

(Add `NEXT_PUBLIC_SOLANA_RPC_URL` to `.env.local` / `.env.example` — same value as `SOLANA_RPC_URL`, but exposed to the client for the connection.)

- [ ] **Step 3: Write `src/components/useSignedAction.ts`**

```typescript
'use client';
import { useWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';

export interface SignedPayload {
  wallet: string;
  message: string;
  signature: string;
}

export function useSignedAction() {
  const { publicKey, signMessage } = useWallet();

  async function sign(action: string): Promise<SignedPayload> {
    if (!publicKey || !signMessage) throw new Error('Connect your wallet first');
    const ts = Date.now();
    const message = `$TICKER Bounties — proving wallet ownership to ${action}.\nTimestamp: ${ts}`;
    const sig = await signMessage(new TextEncoder().encode(message));
    return {
      wallet: publicKey.toBase58(),
      message,
      signature: bs58.encode(sig),
    };
  }

  return { connected: !!publicKey, sign };
}
```

Note: the message string here must stay byte-identical to `buildMessage` in `src/lib/auth/signature.ts`. Both use: `` `$TICKER Bounties — proving wallet ownership to ${action}.\nTimestamp: ${ts}` ``.

- [ ] **Step 4: Write `src/components/ConnectWallet.tsx`**

```tsx
'use client';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
export function ConnectWallet() {
  return <WalletMultiButton />;
}
```

- [ ] **Step 5: Wire the provider into `src/app/layout.tsx`**

Replace the file body so it imports `./globals.css`, wraps `{children}` in `<Providers>`, and sets `<html lang="en">`:

```tsx
import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: '$TICKER Bounties',
  description: 'Community bounty board for $TICKER',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: build succeeds (pages compile). Fix any type errors before continuing.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: wallet provider, connect button, signing hook"
```

---

## Task 18: Board page + components

**Files:**
- Create: `src/components/BountyRow.tsx`, `src/components/BountyList.tsx`, `src/components/ProposeForm.tsx`, `src/components/NavBar.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Write `src/components/NavBar.tsx`**

```tsx
import Link from 'next/link';
import { ConnectWallet } from './ConnectWallet';

export function NavBar({ active }: { active: 'board' | 'top' | 'done' }) {
  const link = (href: string, key: string, label: string) => (
    <Link href={href} className={active === key ? 'nav-link nav-active' : 'nav-link'}>
      {label}
    </Link>
  );
  return (
    <nav className="nav">
      <div className="brand">▮ $TICKER<span className="brand-dim">/bounties</span></div>
      <div className="nav-right">
        {link('/', 'board', 'board')}
        {link('/top', 'top', 'top 10')}
        {link('/done', 'done', 'done')}
        <ConnectWallet />
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Write `src/components/BountyRow.tsx`**

```tsx
'use client';
import { useState } from 'react';
import type { Bounty } from '@/lib/types';
import { useSignedAction } from './useSignedAction';

export function BountyRow({ bounty, admin = false }: { bounty: Bounty; admin?: boolean }) {
  const { connected, sign } = useSignedAction();
  const [count, setCount] = useState(bounty.votes_count);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function vote() {
    if (!connected) { setMsg('Connect your wallet first'); return; }
    setBusy(true); setMsg('');
    try {
      const signed = await sign('vote');
      const res = await fetch(`/api/bounties/${bounty.id}/vote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(signed),
      });
      const data = await res.json();
      if (data.ok) setCount((c) => c + 1);
      else setMsg(data.error);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function adminAction(kind: 'done' | 'delete') {
    setBusy(true); setMsg('');
    try {
      const signed = await sign(kind);
      const res = await fetch(`/api/admin/${kind}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...signed, id: bounty.id }),
      });
      const data = await res.json();
      if (data.ok) location.reload();
      else setMsg(data.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="row">
      <button className="vote" onClick={vote} disabled={busy} aria-label="upvote">
        <span className="arrow">▲</span>
        <span className="count">{count}</span>
      </button>
      <div className="row-body">
        <div className="row-title">{bounty.title}</div>
        <div className="row-desc">{bounty.description}</div>
        <div className="row-meta">
          reward {bounty.reward_sol} SOL · by {bounty.author_wallet.slice(0, 4)}…
          {bounty.author_wallet.slice(-2)} · {new Date(bounty.created_at).toLocaleDateString()}
        </div>
        {admin && (
          <div className="admin-actions">
            <button onClick={() => adminAction('done')} disabled={busy}>mark done</button>
            <button onClick={() => adminAction('delete')} disabled={busy}>delete</button>
          </div>
        )}
        {msg && <div className="row-error">{msg}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write `src/components/BountyList.tsx`**

```tsx
import type { Bounty } from '@/lib/types';
import { BountyRow } from './BountyRow';

export function BountyList({ bounties, admin = false }: { bounties: Bounty[]; admin?: boolean }) {
  if (bounties.length === 0) return <p className="empty">No bounties yet.</p>;
  return (
    <div className="list">
      {bounties.map((b) => (
        <BountyRow key={b.id} bounty={b} admin={admin} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Write `src/components/ProposeForm.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { useSignedAction } from './useSignedAction';

export function ProposeForm() {
  const { connected, sign } = useSignedAction();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reward, setReward] = useState('0');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!connected) { setMsg('Connect your wallet first'); return; }
    setBusy(true); setMsg('');
    try {
      const signed = await sign('propose');
      const res = await fetch('/api/bounties', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...signed, title, description, reward_sol: Number(reward) }),
      });
      const data = await res.json();
      if (data.ok) location.reload();
      else setMsg(data.error);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="prompt" onClick={() => setOpen(true)}>
        <span className="caret">&gt;</span> propose a bounty<span className="cursor">_</span>
      </button>
    );
  }
  return (
    <div className="form">
      <input className="input" placeholder="title" value={title}
        maxLength={140} onChange={(e) => setTitle(e.target.value)} />
      <textarea className="input" placeholder="description" value={description}
        maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
      <input className="input" type="number" min="0" step="0.1" placeholder="reward (SOL)"
        value={reward} onChange={(e) => setReward(e.target.value)} />
      <div className="form-actions">
        <button onClick={submit} disabled={busy}>post</button>
        <button onClick={() => setOpen(false)} disabled={busy}>cancel</button>
      </div>
      <div className="hint">hold ≥ $10 of $TICKER to post · 5 min between posts</div>
      {msg && <div className="row-error">{msg}</div>}
    </div>
  );
}
```

- [ ] **Step 5: Write `src/app/page.tsx`**

```tsx
import { NavBar } from '@/components/NavBar';
import { ProposeForm } from '@/components/ProposeForm';
import { BountyList } from '@/components/BountyList';
import { listActiveBounties } from '@/lib/db/bounties';

export const dynamic = 'force-dynamic';

export default async function BoardPage() {
  const bounties = await listActiveBounties();
  return (
    <main className="page">
      <NavBar active="board" />
      <ProposeForm />
      <BountyList bounties={bounties} />
    </main>
  );
}
```

- [ ] **Step 6: Verify build + manual check**

Run: `npm run build && npm run dev`
Expected: `/` renders the nav, the propose prompt, and the (initially empty or seeded) list. Post a bounty via the form with a wallet holding ≥ $10 and confirm it appears.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: board page, nav, bounty list, propose form, voting"
```

---

## Task 19: Top 10 page

**Files:**
- Create: `src/app/top/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import { NavBar } from '@/components/NavBar';
import { BountyList } from '@/components/BountyList';
import { topBounties } from '@/lib/db/bounties';

export const dynamic = 'force-dynamic';

export default async function TopPage() {
  const bounties = await topBounties(10);
  return (
    <main className="page">
      <NavBar active="top" />
      <h1 className="page-title">Top 10 bounties</h1>
      <BountyList bounties={bounties} />
    </main>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm run dev` → visit `/top`. Expected: shows up to 10 active bounties, highest votes first.

- [ ] **Step 3: Commit**

```bash
git add src/app/top/page.tsx
git commit -m "feat: Top 10 page"
```

---

## Task 20: Done page

**Files:**
- Create: `src/app/done/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import { NavBar } from '@/components/NavBar';
import { BountyList } from '@/components/BountyList';
import { listDoneBounties } from '@/lib/db/bounties';

export const dynamic = 'force-dynamic';

export default async function DonePage() {
  const bounties = await listDoneBounties();
  return (
    <main className="page">
      <NavBar active="done" />
      <h1 className="page-title">Completed bounties</h1>
      <BountyList bounties={bounties} />
    </main>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm run dev` → visit `/done`. Mark a bounty done via the admin page (Task 21) and confirm it appears here and disappears from `/`.

- [ ] **Step 3: Commit**

```bash
git add src/app/done/page.tsx
git commit -m "feat: Done page"
```

---

## Task 21: Admin page

**Files:**
- Create: `src/app/admin/page.tsx`, `src/components/AdminGate.tsx`

The admin page renders the active list with admin actions. The API already enforces admin rights server-side; the page just exposes the buttons. `AdminGate` shows a connect prompt and a note that only allow-listed wallets can act.

- [ ] **Step 1: Write `src/components/AdminGate.tsx`**

```tsx
'use client';
import { useWallet } from '@solana/wallet-adapter-react';
import { ConnectWallet } from './ConnectWallet';

export function AdminGate({ children }: { children: React.ReactNode }) {
  const { connected } = useWallet();
  if (!connected) {
    return (
      <div className="admin-gate">
        <p>Connect an admin wallet to moderate.</p>
        <ConnectWallet />
      </div>
    );
  }
  return <>{children}</>;
}
```

- [ ] **Step 2: Write `src/app/admin/page.tsx`**

```tsx
import { NavBar } from '@/components/NavBar';
import { BountyList } from '@/components/BountyList';
import { AdminGate } from '@/components/AdminGate';
import { listActiveBounties } from '@/lib/db/bounties';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const bounties = await listActiveBounties();
  return (
    <main className="page">
      <NavBar active="board" />
      <h1 className="page-title">Admin — moderation</h1>
      <AdminGate>
        <BountyList bounties={bounties} admin />
      </AdminGate>
    </main>
  );
}
```

- [ ] **Step 3: Verify**

Ensure your wallet is in the `admins` table. Run `npm run dev` → visit `/admin`, connect, and confirm "mark done" / "delete" work and that a non-admin wallet gets "Not authorized".

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/page.tsx src/components/AdminGate.tsx
git commit -m "feat: admin moderation page"
```

---

## Task 22: Terminal-dark theme

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace `src/app/globals.css` with the theme**

```css
:root {
  --bg: #0a0e0a;
  --panel: #0d140d;
  --line: #14241a;
  --green: #00ff66;
  --green-dim: #7fae8f;
  --amber: #ffb300;
  --text: #cfe8d6;
  --text-bright: #e6fff0;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: 'Courier New', ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 14px;
}

.page { max-width: 760px; margin: 0 auto; padding: 0 16px 60px; }

.nav {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 0; border-bottom: 1px solid #1f4d2f; margin-bottom: 8px;
}
.brand { color: var(--green); font-weight: bold; }
.brand-dim { color: var(--green-dim); opacity: .6; }
.nav-right { display: flex; gap: 16px; align-items: center; }
.nav-link { color: var(--green-dim); text-decoration: none; }
.nav-active { color: var(--green); border-bottom: 1px solid var(--green); }

.prompt {
  display: block; width: 100%; text-align: left; background: none;
  border: 0; color: var(--green-dim); cursor: pointer; padding: 14px 0;
  border-bottom: 1px solid var(--line); font: inherit;
}
.caret { color: var(--green); }
.cursor { opacity: .5; }

.form { padding: 14px 0; border-bottom: 1px solid var(--line); display: grid; gap: 8px; }
.input {
  background: var(--panel); border: 1px solid var(--line); color: var(--text-bright);
  padding: 8px; font: inherit; border-radius: 2px;
}
.form-actions, .admin-actions { display: flex; gap: 8px; }
.form button, .admin-actions button, .admin-gate button {
  background: none; border: 1px solid var(--green); color: var(--green);
  padding: 6px 12px; cursor: pointer; font: inherit;
}
.hint { color: var(--green-dim); opacity: .7; font-size: 11px; }

.list { padding: 6px 0; }
.row { display: flex; gap: 14px; padding: 12px 0; border-top: 1px solid var(--line); }
.row:first-child { border-top: 0; }
.vote {
  display: flex; flex-direction: column; align-items: center; min-width: 46px;
  background: none; border: 0; cursor: pointer; color: var(--green);
}
.vote .arrow { color: var(--amber); }
.vote .count { font-weight: bold; font-size: 15px; }
.row-body { flex: 1; }
.row-title { color: var(--text-bright); }
.row-desc { color: var(--text); opacity: .85; margin: 4px 0; }
.row-meta { color: var(--green-dim); font-size: 11px; }
.row-error { color: #ff6b6b; font-size: 12px; margin-top: 4px; }
.empty { color: var(--green-dim); padding: 24px 0; }
.page-title { color: var(--green); font-size: 18px; }
.admin-gate { padding: 40px 0; display: grid; gap: 12px; }

/* Tone down the default wallet-adapter button to match the theme */
.wallet-adapter-button {
  background: transparent !important; border: 1px solid var(--green) !important;
  color: var(--green) !important; height: auto !important; padding: 6px 12px !important;
  font-family: inherit !important; font-size: 13px !important;
}
```

- [ ] **Step 2: Verify**

Run: `npm run dev` → all pages render in the dark terminal theme; the connect button matches.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "style: terminal-dark theme"
```

---

## Task 23: Final checks, README, deploy notes

**Files:**
- Create: `README.md`

- [ ] **Step 1: Run the full test suite + typecheck + build**

```bash
npm test
npx tsc --noEmit
npm run build
```

Expected: all unit tests pass (Tasks 5–9), no type errors, build succeeds.

- [ ] **Step 2: Write `README.md`**

````markdown
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
1. Push to GitHub (done: `nonodevsomecoin/bounty-board`).
2. Import the repo in Vercel.
3. Add all env vars from `.env.example` in Vercel Project Settings → Environment Variables.
4. Deploy. Add the custom `.xyz` domain in Settings → Domains.
````

- [ ] **Step 3: Commit + push**

```bash
git add -A
git commit -m "docs: README and deploy notes"
git push
```

---

## Self-Review (completed during planning)

- **Spec coverage:** wallet auth (T5,T13,T17) · $10 threshold (T6,T8,T9,T13) · 1 vote/wallet (T3 unique constraint, T12, T15) · 5-min cooldown (T7,T14) · propose (T14) · board/top/done (T18–20) · admin delete + mark done (T16,T21) · English UI (T17 `lang="en"`, copy) · terminal-dark style (T22) · Supabase+Vercel+.xyz (T3,T10,T23). All sections covered.
- **Placeholders:** none — every code step contains full code; `$TICKER` is an intentional brand token to be swapped for the real ticker, noted in spec §10.
- **Type consistency:** `Bounty` shape used identically across db/components/api; `GuardResult`, `EligibilityResult`, `CooldownResult`, `AddVoteResult` defined once and consumed consistently; the signed-message string is duplicated in exactly two places (T5 `buildMessage`, T17 hook) with an explicit note to keep them byte-identical.
