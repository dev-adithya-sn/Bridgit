-- ============================================================
-- SIH 2026 · PS #43 (SIH26043) — Disaster Response Platform
-- Run this whole file once in the Supabase SQL Editor.
-- ============================================================

-- ---------- profiles (one per signed-up user) ----------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null default '',
  role text not null default 'citizen'
    check (role in ('citizen','ngo','camp','university_team','admin')),
  org_name text,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever someone signs up,
-- using the name/role/org they chose on the signup form.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, org_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'role', 'citizen'),
    new.raw_user_meta_data ->> 'org_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- relief camps ----------
create table public.camps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  district text not null,
  lat double precision not null,
  lng double precision not null,
  population integer not null default 0,
  contact text,
  created_by uuid references auth.users,
  created_at timestamptz not null default now()
);

-- ---------- crowdsourced problems (the PS #43 core) ----------
create table public.problems (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  category text not null,
  district text not null,
  ward text,
  lat double precision,
  lng double precision,
  urgency integer not null default 3 check (urgency between 1 and 5),
  population_affected integer not null default 0,
  status text not null default 'open' check (status in ('open','claimed','resolved')),
  posted_by uuid references auth.users,
  poster_name text,
  claimed_by uuid references auth.users,
  claimed_by_name text,
  solution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- available resources (supply) ----------
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  type text not null,          -- water / food / medicine / shelter / clothing / sanitation
  quantity integer not null check (quantity > 0),
  quantity_remaining integer not null,
  unit text not null,
  district text,
  lat double precision not null,
  lng double precision not null,
  posted_by uuid references auth.users,
  donor_name text,
  status text not null default 'available' check (status in ('available','allocated')),
  created_at timestamptz not null default now()
);

-- ---------- camp needs (demand) ----------
create table public.needs (
  id uuid primary key default gen_random_uuid(),
  camp_id uuid not null references public.camps on delete cascade,
  type text not null,
  quantity_needed integer not null check (quantity_needed > 0),
  quantity_received integer not null default 0,
  unit text not null,
  urgency integer not null default 3 check (urgency between 1 and 5),
  status text not null default 'open' check (status in ('open','fulfilled')),
  posted_by uuid references auth.users,
  created_at timestamptz not null default now()
);

-- ---------- supply→need matches (the differentiator) ----------
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources on delete cascade,
  need_id uuid not null references public.needs on delete cascade,
  quantity_allocated integer not null check (quantity_allocated > 0),
  score double precision not null,
  score_breakdown jsonb not null default '{}',
  status text not null default 'suggested'
    check (status in ('suggested','accepted','delivered','declined')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security: everyone can read, signed-in users can write.
-- (Deliberately permissive for the hackathon prototype.)
-- ============================================================
alter table public.profiles  enable row level security;
alter table public.camps     enable row level security;
alter table public.problems  enable row level security;
alter table public.resources enable row level security;
alter table public.needs     enable row level security;
alter table public.matches   enable row level security;

create policy "public read"  on public.profiles  for select using (true);
create policy "own profile"  on public.profiles  for update using (auth.uid() = id);

create policy "public read"  on public.camps     for select using (true);
create policy "auth write"   on public.camps     for insert to authenticated with check (true);
create policy "auth update"  on public.camps     for update to authenticated using (true);

create policy "public read"  on public.problems  for select using (true);
create policy "auth write"   on public.problems  for insert to authenticated with check (true);
create policy "auth update"  on public.problems  for update to authenticated using (true);

create policy "public read"  on public.resources for select using (true);
create policy "auth write"   on public.resources for insert to authenticated with check (true);
create policy "auth update"  on public.resources for update to authenticated using (true);

create policy "public read"  on public.needs     for select using (true);
create policy "auth write"   on public.needs     for insert to authenticated with check (true);
create policy "auth update"  on public.needs     for update to authenticated using (true);

create policy "public read"  on public.matches   for select using (true);
create policy "auth write"   on public.matches   for insert to authenticated with check (true);
create policy "auth update"  on public.matches   for update to authenticated using (true);
