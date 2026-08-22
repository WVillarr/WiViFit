-- Run this in the Supabase SQL editor before enabling sync.

create table if not exists public.routines (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  split_type text,
  days_per_week integer not null,
  is_active boolean not null default false,
  source text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create table if not exists public.routine_days (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_id text not null,
  day_index integer not null,
  name text not null,
  budget_minutes integer,
  deleted_at timestamptz,
  updated_at timestamptz not null
);

create table if not exists public.routine_exercises (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_day_id text not null,
  exercise_id text not null,
  order_index integer not null,
  target_sets integer not null,
  rep_range_min integer,
  rep_range_max integer,
  target_duration_seconds integer,
  target_distance_meters integer,
  rest_seconds integer not null,
  deleted_at timestamptz,
  updated_at timestamptz not null
);

create table if not exists public.workout_sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_day_id text,
  started_at timestamptz not null,
  ended_at timestamptz,
  total_volume_kg real,
  deleted_at timestamptz,
  updated_at timestamptz not null
);

create table if not exists public.session_sets (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  exercise_id text not null,
  set_index integer not null,
  weight_kg real,
  reps integer,
  duration_seconds integer,
  distance_meters real,
  is_warmup boolean not null default false,
  completed_at timestamptz not null,
  deleted_at timestamptz,
  updated_at timestamptz not null
);

create table if not exists public.personal_records (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null,
  type text not null,
  value real not null,
  context_weight_kg real,
  achieved_at timestamptz not null,
  session_set_id text not null,
  updated_at timestamptz not null
);

create index if not exists routines_user_updated_idx on public.routines(user_id, updated_at);
create index if not exists routine_days_user_idx on public.routine_days(user_id);
create index if not exists routine_exercises_user_idx on public.routine_exercises(user_id);
create index if not exists workout_sessions_user_updated_idx on public.workout_sessions(user_id, updated_at);
create index if not exists session_sets_user_idx on public.session_sets(user_id);
create index if not exists personal_records_user_idx on public.personal_records(user_id);

alter table public.routines enable row level security;
alter table public.routine_days enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.session_sets enable row level security;
alter table public.personal_records enable row level security;

drop policy if exists routines_owner on public.routines;
drop policy if exists routine_days_owner on public.routine_days;
drop policy if exists routine_exercises_owner on public.routine_exercises;
drop policy if exists workout_sessions_owner on public.workout_sessions;
drop policy if exists session_sets_owner on public.session_sets;
drop policy if exists personal_records_owner on public.personal_records;

create policy routines_owner on public.routines for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy routine_days_owner on public.routine_days for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy routine_exercises_owner on public.routine_exercises for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy workout_sessions_owner on public.workout_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy session_sets_owner on public.session_sets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy personal_records_owner on public.personal_records for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
