-- ============================================================
-- Migration 003 — Societal Innovation Collaboration Portal: domain routing
-- Run once in the Supabase SQL Editor, after migrations 001 and 002.
-- Safe to re-run: every statement is idempotent.
--
-- Out of scope here: camps / resources / needs / matches (disaster
-- logistics) are untouched — this migration only adds problems.domain and
-- the institution / industry-partner / routing tables.
-- ============================================================

-- ---------- problems.domain ----------
alter table public.problems add column if not exists domain text;

-- Backfill domain from the old free-text category column, mapping the
-- disaster-era categories (and the community ones added in 002) onto the
-- new PROBLEM_DOMAINS. Only touches rows that don't have a domain yet, so
-- re-running this file never clobbers a domain set afterwards.
update public.problems
set domain = case category
  when 'Medical' then 'Healthcare'
  when 'Public Health' then 'Healthcare'
  when 'Food & Water' then 'Agriculture'
  when 'Sanitation' then 'Sanitation'
  when 'Shelter' then 'Urban Development'
  when 'Infrastructure' then 'Urban Development'
  when 'Civic Infrastructure' then 'Urban Development'
  when 'Rescue' then 'Public Administration'
  when 'Safety' then 'Public Administration'
  when 'Education' then 'Education'
  when 'Environment' then 'Environment'
  else null
end
where domain is null;

-- Restrict to the PROBLEM_DOMAINS values. Added NOT VALID so existing rows
-- that didn't map (category = 'Other', or anything unmapped) don't block
-- the migration; validated separately once you've triaged those manually.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'problems_domain_check'
  ) then
    alter table public.problems
      add constraint problems_domain_check
      check (
        domain is null or domain in (
          'Education', 'Healthcare', 'Agriculture', 'Water Resources',
          'Sanitation', 'Environment', 'Energy', 'Urban Development',
          'Accessibility', 'Public Administration', 'Rural Livelihoods'
        )
      ) not valid;
  end if;
end $$;

-- Validate now if every row already satisfies it (e.g. a fresh install with
-- no unmapped categories); if some rows are still null/unmapped this is a
-- no-op until you backfill them and validate manually — it never blocks
-- writes in the meantime because the constraint is NOT VALID above.
do $$
begin
  begin
    alter table public.problems validate constraint problems_domain_check;
  exception when check_violation then
    raise notice 'problems_domain_check left NOT VALID — some rows still have an unmapped domain; backfill and VALIDATE CONSTRAINT manually.';
  end;
end $$;

-- ---------- institutions ----------
create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  district text,
  domains text[] not null default '{}',
  description text,
  has_incubation_cell boolean not null default false,
  contact_name text,
  contact_email text,
  created_by uuid references auth.users,
  created_at timestamptz not null default now()
);

create index if not exists institutions_domains_idx on public.institutions using gin (domains);

-- ---------- industry partners ----------
create table if not exists public.industry_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sector text not null,
  domains text[] not null default '{}',
  capabilities text,
  contact_name text,
  contact_email text,
  created_by uuid references auth.users,
  created_at timestamptz not null default now()
);

create index if not exists industry_partners_domains_idx on public.industry_partners using gin (domains);

-- ---------- problem routing (mirrors public.matches) ----------
create table if not exists public.problem_routing (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems on delete cascade,
  institution_id uuid not null references public.institutions on delete cascade,
  method text not null check (method in ('llm', 'tag')),
  confidence numeric not null check (confidence between 0 and 100),
  reasoning text not null,
  status text not null default 'suggested'
    check (status in ('suggested', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);

create index if not exists problem_routing_problem_id_idx on public.problem_routing (problem_id);
create index if not exists problem_routing_institution_id_idx on public.problem_routing (institution_id);

-- ---------- RLS ----------
-- Public read on institutions and industry_partners (directory data).
-- problem_routing is public read too, but writes are admin-only: routing is
-- produced by the server-side LLM call (like migration 002 removed direct
-- problem inserts), not posted freely by users.
alter table public.institutions enable row level security;
alter table public.industry_partners enable row level security;
alter table public.problem_routing enable row level security;

drop policy if exists "public read" on public.institutions;
create policy "public read" on public.institutions for select using (true);

drop policy if exists "public read" on public.industry_partners;
create policy "public read" on public.industry_partners for select using (true);

drop policy if exists "public read" on public.problem_routing;
create policy "public read" on public.problem_routing for select using (true);

drop policy if exists "admin write" on public.problem_routing;
create policy "admin write" on public.problem_routing for insert
  to authenticated with check (public.is_admin());

drop policy if exists "admin update" on public.problem_routing;
create policy "admin update" on public.problem_routing for update
  to authenticated using (public.is_admin());
