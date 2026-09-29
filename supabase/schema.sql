-- VeryFY cloud schema
-- Run this in the Supabase SQL editor after creating a project.
-- The desktop app uses the publishable anon key only. Never ship a service role key.

create extension if not exists pgcrypto;

create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  device_model text not null,
  serial_last4 text,
  ios_version text,
  battery_health integer check (battery_health between 0 and 100),
  cycle_count integer check (cycle_count is null or cycle_count >= 0),
  condition_score integer check (condition_score between 0 and 100),
  parts_summary jsonb not null default '{}'::jsonb,
  test_summary jsonb not null default '{}'::jsonb,
  report_text text
);

create index if not exists inspections_created_at_idx on public.inspections (created_at desc);
create index if not exists inspections_created_by_idx on public.inspections (created_by);

alter table public.inspections enable row level security;

-- Signed-in technicians can create their own inspection record.
drop policy if exists "Technicians can insert own inspections" on public.inspections;
create policy "Technicians can insert own inspections"
  on public.inspections
  for insert
  to authenticated
  with check (auth.uid() = created_by);

-- Signed-in technicians can read their own inspection history.
drop policy if exists "Technicians can read own inspections" on public.inspections;
create policy "Technicians can read own inspections"
  on public.inspections
  for select
  to authenticated
  using (auth.uid() = created_by);

-- Signed-in technicians can update their own inspection records.
drop policy if exists "Technicians can update own inspections" on public.inspections;
create policy "Technicians can update own inspections"
  on public.inspections
  for update
  to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

-- Signed-in technicians can delete their own inspection records.
drop policy if exists "Technicians can delete own inspections" on public.inspections;
create policy "Technicians can delete own inspections"
  on public.inspections
  for delete
  to authenticated
  using (auth.uid() = created_by);
