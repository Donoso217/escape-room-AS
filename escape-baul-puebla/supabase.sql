-- El baúl de la Puebla: tablas para el ranking en vivo.
-- Pegar todo en Supabase → SQL Editor → Run.

create table if not exists public.games (
  code        text primary key,
  team_size   int  not null default 4,
  groups      jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  game_code   text not null references public.games(code) on delete cascade,
  name        text not null,
  members     text,
  "lock"      int  not null default 0,
  hints       int  not null default 0,
  errors      int  not null default 0,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  updated_at  timestamptz not null default now()
);
create index if not exists teams_game_idx on public.teams(game_code);

-- Acceso público con la clave anon (es una actividad de clase, sin datos sensibles).
alter table public.games enable row level security;
alter table public.teams enable row level security;

drop policy if exists games_read   on public.games;
drop policy if exists games_insert on public.games;
drop policy if exists teams_read   on public.teams;
drop policy if exists teams_insert on public.teams;
drop policy if exists teams_update on public.teams;

create policy games_read   on public.games for select to anon using (true);
create policy games_insert on public.games for insert to anon with check (true);
create policy teams_read   on public.teams for select to anon using (true);
create policy teams_insert on public.teams for insert to anon with check (true);
create policy teams_update on public.teams for update to anon using (true) with check (true);

-- Después del taller se puede limpiar todo con:
-- delete from public.games;
