-- ─────────────────────────────────────────────────────────────
-- Phase 1: identity — profiles, teams, team membership.
-- Every table has Row Level Security enabled.
-- Later phases add: projects, jobs, assets, prompts, recipes,
-- usage_ledger, settings.
-- ─────────────────────────────────────────────────────────────

create type public.team_role as enum ('owner', 'admin', 'member');

-- Profiles: one row per auth user.
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  locale      text not null default 'ar' check (locale in ('ar', 'en')),
  created_at  timestamptz not null default now()
);

create table public.teams (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  -- Monthly budget in Higgsfield credits; null = unlimited.
  monthly_budget        numeric(12, 2),
  created_at            timestamptz not null default now()
);

create table public.team_members (
  team_id          uuid not null references public.teams (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  role             public.team_role not null default 'member',
  -- Per-member daily spending cap in credits; null = no cap.
  daily_cap        numeric(12, 2),
  created_at       timestamptz not null default now(),
  primary key (team_id, user_id)
);

create index team_members_user_idx on public.team_members (user_id);

-- ─── Helper functions (security definer avoids RLS recursion) ─

create or replace function public.is_team_member(p_team uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team and user_id = auth.uid()
  );
$$;

create or replace function public.has_team_role(p_team uuid, p_roles public.team_role[])
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team and user_id = auth.uid() and role = any (p_roles)
  );
$$;

-- ─── RLS ──────────────────────────────────────────────────────

alter table public.profiles     enable row level security;
alter table public.teams        enable row level security;
alter table public.team_members enable row level security;

-- Profiles: read yourself + teammates; update only yourself.
create policy "profiles_select" on public.profiles for select using (
  id = auth.uid()
  or exists (
    select 1 from public.team_members me
    join public.team_members them on them.team_id = me.team_id
    where me.user_id = auth.uid() and them.user_id = profiles.id
  )
);
create policy "profiles_update_self" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- Teams: members read; owners/admins update.
create policy "teams_select" on public.teams for select using (public.is_team_member(id));
create policy "teams_update" on public.teams for update
  using (public.has_team_role(id, array['owner', 'admin']::public.team_role[]));

-- Membership: members read their team; owners/admins manage.
create policy "team_members_select" on public.team_members for select
  using (public.is_team_member(team_id));
create policy "team_members_insert" on public.team_members for insert
  with check (public.has_team_role(team_id, array['owner', 'admin']::public.team_role[]));
create policy "team_members_update" on public.team_members for update
  using (public.has_team_role(team_id, array['owner', 'admin']::public.team_role[]));
create policy "team_members_delete" on public.team_members for delete
  using (public.has_team_role(team_id, array['owner', 'admin']::public.team_role[]));

-- ─── New user bootstrap ───────────────────────────────────────
-- Creates a profile and a personal team (owner) for every new sign-up.
-- To invite someone into an existing team instead, an owner/admin adds
-- a team_members row (UI in Phase 6).

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  new_team uuid;
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );

  insert into public.teams (name)
  values (coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)) || '''s team')
  returning id into new_team;

  insert into public.team_members (team_id, user_id, role)
  values (new_team, new.id, 'owner');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
