-- ============================================================
-- Migration 001 — AI capability matching + WhatsApp outreach
-- Run once in the Supabase SQL Editor, AFTER schema.sql and seed.sql.
-- Safe to re-run: every statement is idempotent.
-- ============================================================

-- ---------- donor capability + contact fields ----------
alter table public.profiles add column if not exists capability_description text;
alter table public.profiles add column if not exists phone_number text;
alter table public.profiles add column if not exists email text;

-- Free-text description of a need, used by the AI matcher
alter table public.needs add column if not exists description text;

-- Email is public for donors only: backfill it for existing NGO/camp
-- profiles; citizen / university / admin rows stay null.
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and p.role in ('ngo', 'camp')
  and p.email is null;

-- New signups also capture capability, phone, and (donors only) email.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_role text := coalesce(new.raw_user_meta_data ->> 'role', 'citizen');
begin
  insert into public.profiles
    (id, full_name, role, org_name, capability_description, phone_number, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new_role,
    new.raw_user_meta_data ->> 'org_name',
    nullif(new.raw_user_meta_data ->> 'capability_description', ''),
    nullif(new.raw_user_meta_data ->> 'phone_number', ''),
    case when new_role in ('ngo', 'camp') then new.email end
  );
  return new;
end;
$$;

-- ---------- contact privacy ----------
-- Anonymous visitors may read every profile column EXCEPT phone_number.
-- Logged-in users (and the server, which forwards the caller's session)
-- keep full access, which the WhatsApp notify route needs.
-- NOTE: any column added to profiles later must be granted to anon here
-- explicitly, or anonymous reads of it will be denied.
revoke select on public.profiles from anon;
grant select (id, full_name, role, org_name, created_at, capability_description, email)
  on public.profiles to anon;

-- ---------- outreach log ----------
create table if not exists public.outreach (
  id uuid primary key default gen_random_uuid(),
  need_id uuid not null references public.needs on delete cascade,
  donor_profile_id uuid not null references public.profiles on delete cascade,
  match_reasoning text,
  confidence numeric check (confidence between 0 and 100),
  channel text not null default 'whatsapp' check (channel in ('whatsapp')),
  status text not null check (status in ('sent', 'failed', 'responded')),
  created_at timestamptz not null default now()
);

alter table public.outreach enable row level security;

drop policy if exists "auth read" on public.outreach;
drop policy if exists "auth write" on public.outreach;
drop policy if exists "auth update" on public.outreach;
create policy "auth read"   on public.outreach for select to authenticated using (true);
create policy "auth write"  on public.outreach for insert to authenticated with check (true);
create policy "auth update" on public.outreach for update to authenticated using (true);
