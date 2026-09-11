-- ============================================================
-- Migration 004 — institution representatives
-- Run once in the Supabase SQL Editor, after migration 003.
-- Safe to re-run: every statement is idempotent.
--
-- Minimal membership model so "accept this routing suggestion on behalf of
-- our institution" has someone real behind it. A profile becomes a
-- representative only once an admin marks them verified — self-signup here
-- would just move the RLS gap app/api/route-problem was closing right back
-- into a table anyone could insert into.
-- ============================================================

create table if not exists public.institution_representatives (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions on delete cascade,
  profile_id uuid not null references public.profiles on delete cascade,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (institution_id, profile_id)
);

create index if not exists institution_representatives_profile_id_idx
  on public.institution_representatives (profile_id);

alter table public.institution_representatives enable row level security;

-- A rep can see their own membership rows (so the UI can show "you're a
-- verified rep of X"); admins can see all. Not public — this is an
-- authorization mapping, not directory data like institutions itself.
drop policy if exists "self or admin read" on public.institution_representatives;
create policy "self or admin read" on public.institution_representatives for select
  to authenticated using (profile_id = auth.uid() or public.is_admin());

-- Only admins add, verify, or remove representatives. This is the trust
-- boundary the accept-routing check in app/api/route-problem/respond relies
-- on, so it is deliberately not self-service.
drop policy if exists "admin write" on public.institution_representatives;
create policy "admin write" on public.institution_representatives for insert
  to authenticated with check (public.is_admin());

drop policy if exists "admin update" on public.institution_representatives;
create policy "admin update" on public.institution_representatives for update
  to authenticated using (public.is_admin());

drop policy if exists "admin delete" on public.institution_representatives;
create policy "admin delete" on public.institution_representatives for delete
  to authenticated using (public.is_admin());
