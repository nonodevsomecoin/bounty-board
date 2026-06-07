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
  votes_count   int not null default 0,
  proof_url     text
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

drop policy if exists "public read votes" on votes;
create policy "public read votes" on votes for select using (true);
-- No insert/update/delete policies => only the service-role key (which bypasses
-- RLS) can write. All writes go through our API routes.

create index if not exists idx_bounties_active_votes
  on bounties (votes_count desc) where status = 'active';
