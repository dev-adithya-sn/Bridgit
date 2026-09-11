-- ============================================================
-- Migration 005 — institution / industry-partner roles
-- Run once in the Supabase SQL Editor, after migration 004.
-- Safe to re-run: every statement is idempotent.
--
-- Lets a profile's role be 'institution' or 'industry_partner' so someone
-- can sign up to represent one. The original check constraint from
-- schema.sql (auto-named profiles_role_check by Postgres) didn't allow
-- either value.
-- ============================================================

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in (
    'citizen', 'ngo', 'camp', 'university_team', 'admin',
    'institution', 'industry_partner'
  ));

-- ---------- institutions / industry_partners insert policy ----------
-- Migration 003 gave both tables public read but no insert policy at all,
-- so even an authenticated user couldn't create one directly — by design,
-- creation goes through app/api/institutions and app/api/industry-partners
-- (service-role writes, same pattern as app/api/problems), which also seeds
-- the creator's own institution_representatives row as unverified. No RLS
-- policy is added here for client-side inserts; this note just records why.
