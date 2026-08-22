create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.routines (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  split_type text,
  days_per_week integer not null,
  is_active boolean not null default false,
  source text not null check (source in ('manual', 'generated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.routine_days (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_id text not null,
  day_index integer not null,
  name text not null,
  budget_minutes integer,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
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
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.workout_sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_day_id text,
  started_at timestamptz not null,
  ended_at timestamptz,
  total_volume_kg numeric,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.session_sets (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  exercise_id text not null,
  set_index integer not null,
  weight_kg numeric,
  reps integer,
  duration_seconds integer,
  distance_meters numeric,
  is_warmup boolean not null default false,
  completed_at timestamptz not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.personal_records (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null,
  type text not null check (type in ('estimated_1rm', 'volume', 'reps')),
  value numeric not null,
  context_weight_kg numeric,
  achieved_at timestamptz not null,
  session_set_id text not null,
  updated_at timestamptz not null default now()
);

create index if not exists routines_user_updated_idx on public.routines(user_id, updated_at);
create index if not exists routine_days_user_updated_idx on public.routine_days(user_id, updated_at);
create index if not exists routine_exercises_user_updated_idx on public.routine_exercises(user_id, updated_at);
create index if not exists workout_sessions_user_updated_idx on public.workout_sessions(user_id, updated_at);
create index if not exists session_sets_user_updated_idx on public.session_sets(user_id, updated_at);
create index if not exists personal_records_user_updated_idx on public.personal_records(user_id, updated_at);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'routines', 'routine_days', 'routine_exercises',
    'workout_sessions', 'session_sets', 'personal_records'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists %I on public.%I', 'users can read own ' || table_name, table_name);
    execute format('drop policy if exists %I on public.%I', 'users can write own ' || table_name, table_name);
    execute format('create policy %I on public.%I for select using (auth.uid() = user_id)', 'users can read own ' || table_name, table_name);
    execute format('create policy %I on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', 'users can write own ' || table_name, table_name);
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format('create trigger set_updated_at before insert or update on public.%I for each row execute function public.set_updated_at()', table_name);
  end loop;
end $$;
