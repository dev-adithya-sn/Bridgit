-- ============================================================
-- Migration 002 — community Q&A + AI pre-publish moderation
-- Run once in the Supabase SQL Editor, after migration 001.
-- Safe to re-run: every statement is idempotent.
-- ============================================================

-- ---------- moderation columns on problems ----------
-- Existing problems predate moderation, so they are approved once, when the
-- column is first added. Re-running this file never auto-approves anything.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'problems' and column_name = 'moderation_status'
  ) then
    alter table public.problems
      add column moderation_status text not null default 'pending'
        check (moderation_status in ('pending', 'approved', 'rejected'));
    update public.problems set moderation_status = 'approved';
  end if;
end $$;

alter table public.problems add column if not exists moderation_reason text;

-- ---------- answers: an open thread on every problem ----------
create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems on delete cascade,
  author_profile_id uuid not null references public.profiles on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'approved', 'rejected')),
  moderation_reason text,
  created_at timestamptz not null default now()
);

create index if not exists answers_problem_id_idx on public.answers (problem_id, created_at);

-- ---------- helper: is the caller an admin? ----------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------- visibility ----------
-- Public views show approved rows only; authors always see their own rows;
-- admins see everything.
drop policy if exists "public read" on public.problems;
drop policy if exists "visible problems" on public.problems;
create policy "visible problems" on public.problems for select
  using (moderation_status = 'approved' or posted_by = auth.uid() or public.is_admin());

-- New problems and answers are saved only by the server after moderation
-- (it uses the service-role key, which bypasses RLS), so signed-in users
-- get no direct insert policy.
drop policy if exists "auth write" on public.problems;

alter table public.answers enable row level security;
drop policy if exists "visible answers" on public.answers;
drop policy if exists "admin update answers" on public.answers;
create policy "visible answers" on public.answers for select
  using (moderation_status = 'approved' or author_profile_id = auth.uid() or public.is_admin());
create policy "admin update answers" on public.answers for update
  to authenticated using (public.is_admin());

-- ---------- guard moderation fields ----------
-- The existing "auth update" policy on problems stays (claim -> solution ->
-- resolve needs it). This trigger stops non-admins from approving their own
-- posts, and sends a post back to review if its text is edited afterwards.
-- Runs with the caller's own role (not security definer), so current_user is
-- 'service_role' for the server, 'postgres' in the SQL Editor, and
-- 'authenticated' / 'anon' for browser requests.
create or replace function public.guard_moderation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  privileged boolean := current_user in ('service_role', 'postgres', 'supabase_admin') or public.is_admin();
begin
  if privileged then
    return new;
  end if;

  if new.moderation_status is distinct from old.moderation_status
     or new.moderation_reason is distinct from old.moderation_reason then
    raise exception 'Only admins can change moderation status';
  end if;

  if tg_table_name = 'problems'
     and (new.title is distinct from old.title or new.description is distinct from old.description) then
    new.moderation_status := 'pending';
    new.moderation_reason := 'Edited after publishing — waiting for review.';
  elsif tg_table_name = 'answers' and new.body is distinct from old.body then
    new.moderation_status := 'pending';
    new.moderation_reason := 'Edited after publishing — waiting for review.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_problem_moderation on public.problems;
create trigger guard_problem_moderation
  before update on public.problems
  for each row execute procedure public.guard_moderation();

drop trigger if exists guard_answer_moderation on public.answers;
create trigger guard_answer_moderation
  before update on public.answers
  for each row execute procedure public.guard_moderation();
