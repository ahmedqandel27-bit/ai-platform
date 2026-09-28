-- ─────────────────────────────────────────────────────────────
-- Phase 6: projects, prompt library, team settings, usage & budgets.
-- ─────────────────────────────────────────────────────────────

-- ─── Projects (shared by the team) ────────────────────────────

create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

create index projects_team_idx on public.projects (team_id, created_at desc);

alter table public.projects enable row level security;

create policy "projects_select" on public.projects for select using (public.is_team_member(team_id));
create policy "projects_insert" on public.projects for insert
  with check (public.is_team_member(team_id) and created_by = auth.uid());
create policy "projects_update" on public.projects for update
  using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));
create policy "projects_delete" on public.projects for delete
  using (created_by = auth.uid() or public.has_team_role(team_id, array['owner', 'admin']::public.team_role[]));

-- ─── Jobs: team + project attribution ─────────────────────────

alter table public.jobs add column team_id    uuid references public.teams (id) on delete set null;
alter table public.jobs add column project_id uuid references public.projects (id) on delete set null;

create index jobs_team_created_idx on public.jobs (team_id, created_at desc);
create index jobs_project_idx on public.jobs (project_id, created_at desc);

-- A job may only be filed under a team you belong to, and a project of that team.
drop policy "jobs_insert_own" on public.jobs;
drop policy "jobs_update_own" on public.jobs;

create policy "jobs_insert_own" on public.jobs for insert with check (
  user_id = auth.uid()
  and (team_id is null or public.is_team_member(team_id))
  and (project_id is null or exists (
    select 1 from public.projects p where p.id = project_id and p.team_id = jobs.team_id
  ))
);
create policy "jobs_update_own" on public.jobs for update using (user_id = auth.uid()) with check (
  user_id = auth.uid()
  and (team_id is null or public.is_team_member(team_id))
  and (project_id is null or exists (
    select 1 from public.projects p where p.id = project_id and p.team_id = jobs.team_id
  ))
);

-- Teammates can see generations filed under a project of their team.
create policy "jobs_select_team_projects" on public.jobs for select using (
  project_id is not null and team_id is not null and public.is_team_member(team_id)
);

-- …and open their stored outputs (path: <user_id>/<job_id>/<n>.<ext>).
create policy "outputs_select_team_projects" on storage.objects for select using (
  bucket_id = 'outputs'
  and exists (
    select 1 from public.jobs j
    where j.id::text = (storage.foldername(name))[2]
      and j.project_id is not null
      and j.team_id is not null
      and public.is_team_member(j.team_id)
  )
);

-- ─── Prompt library ───────────────────────────────────────────

create table public.prompts (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  title       text not null check (char_length(title) between 1 and 120),
  body        text not null check (char_length(body) between 1 and 5000),
  tags        text[] not null default '{}',
  surface     text not null default 'any' check (surface in ('image', 'video', 'any')),
  created_at  timestamptz not null default now()
);

create index prompts_team_idx on public.prompts (team_id, created_at desc);

alter table public.prompts enable row level security;

create policy "prompts_select" on public.prompts for select using (public.is_team_member(team_id));
create policy "prompts_insert" on public.prompts for insert
  with check (public.is_team_member(team_id) and created_by = auth.uid());
create policy "prompts_update" on public.prompts for update
  using (created_by = auth.uid() or public.has_team_role(team_id, array['owner', 'admin']::public.team_role[]))
  with check (public.is_team_member(team_id));
create policy "prompts_delete" on public.prompts for delete
  using (created_by = auth.uid() or public.has_team_role(team_id, array['owner', 'admin']::public.team_role[]));

-- ─── Team settings (admin) ────────────────────────────────────

create table public.team_settings (
  team_id          uuid primary key references public.teams (id) on delete cascade,
  -- Model ids hidden from pickers and rejected at submit.
  disabled_models  text[] not null default '{}',
  -- { "image": "<model id>", "video": "<model id>" }
  default_models   jsonb not null default '{}'::jsonb,
  -- { "<model id>": { "perRun": 10, "perSecond": 2 } } in Higgsfield credits (entered by an admin).
  model_costs      jsonb not null default '{}'::jsonb,
  -- Reseller markup % (feature-flagged in the app).
  markup_percent   numeric(6, 2) not null default 0 check (markup_percent between 0 and 1000),
  updated_at       timestamptz not null default now()
);

alter table public.team_settings enable row level security;

create policy "team_settings_select" on public.team_settings for select using (public.is_team_member(team_id));
create policy "team_settings_insert" on public.team_settings for insert
  with check (public.has_team_role(team_id, array['owner', 'admin']::public.team_role[]));
create policy "team_settings_update" on public.team_settings for update
  using (public.has_team_role(team_id, array['owner', 'admin']::public.team_role[]))
  with check (public.has_team_role(team_id, array['owner', 'admin']::public.team_role[]));

-- ─── Team management RPCs ─────────────────────────────────────

-- Members of a team with their profile (any member may list).
create or replace function public.team_members_list(p_team uuid)
returns table (user_id uuid, email text, full_name text, role public.team_role, daily_cap numeric, joined_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select m.user_id, p.email, p.full_name, m.role, m.daily_cap, m.created_at
  from public.team_members m
  join public.profiles p on p.id = m.user_id
  where m.team_id = p_team and public.is_team_member(p_team)
  order by m.created_at;
$$;

-- Adds an existing user (they must have signed up) by e-mail.
create or replace function public.add_team_member(p_team uuid, p_email text, p_role public.team_role)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  target uuid;
begin
  if not public.has_team_role(p_team, array['owner', 'admin']::public.team_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_role = 'owner' and not public.has_team_role(p_team, array['owner']::public.team_role[]) then
    raise exception 'only owners can add owners' using errcode = '42501';
  end if;
  select id into target from public.profiles where lower(email) = lower(trim(p_email));
  if target is null then
    raise exception 'no user with that email — ask them to sign up first' using errcode = 'P0002';
  end if;
  insert into public.team_members (team_id, user_id, role) values (p_team, target, p_role)
  on conflict (team_id, user_id) do nothing;
  return target;
end;
$$;

-- Changes role / daily cap. Guards: admins cannot touch owners or grant owner;
-- a team always keeps at least one owner.
create or replace function public.update_team_member(p_team uuid, p_user uuid, p_role public.team_role, p_daily_cap numeric)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_role public.team_role;
  is_owner boolean := public.has_team_role(p_team, array['owner']::public.team_role[]);
begin
  if not public.has_team_role(p_team, array['owner', 'admin']::public.team_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select role into v_role from public.team_members where team_id = p_team and user_id = p_user;
  if v_role is null then
    raise exception 'not a member' using errcode = 'P0002';
  end if;
  if not is_owner and (v_role = 'owner' or p_role = 'owner') then
    raise exception 'only owners can change owners' using errcode = '42501';
  end if;
  if v_role = 'owner' and p_role <> 'owner'
     and (select count(*) from public.team_members where team_id = p_team and role = 'owner') <= 1 then
    raise exception 'a team needs at least one owner' using errcode = '23514';
  end if;
  if p_daily_cap is not null and p_daily_cap < 0 then
    raise exception 'daily cap must be positive' using errcode = '23514';
  end if;
  update public.team_members set role = p_role, daily_cap = p_daily_cap
  where team_id = p_team and user_id = p_user;
end;
$$;

create or replace function public.remove_team_member(p_team uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_role public.team_role;
begin
  select role into v_role from public.team_members where team_id = p_team and user_id = p_user;
  if v_role is null then return; end if;
  -- Anyone may leave; removing others needs admin (and owner to remove an owner).
  if p_user <> auth.uid() then
    if not public.has_team_role(p_team, array['owner', 'admin']::public.team_role[]) then
      raise exception 'not allowed' using errcode = '42501';
    end if;
    if v_role = 'owner' and not public.has_team_role(p_team, array['owner']::public.team_role[]) then
      raise exception 'only owners can remove owners' using errcode = '42501';
    end if;
  end if;
  if v_role = 'owner'
     and (select count(*) from public.team_members where team_id = p_team and role = 'owner') <= 1 then
    raise exception 'a team needs at least one owner' using errcode = '23514';
  end if;
  delete from public.team_members where team_id = p_team and user_id = p_user;
end;
$$;

-- ─── Usage & budgets ──────────────────────────────────────────

-- Jobs that count towards spend: anything submitted and not rejected up front.
create or replace function public.job_counts_as_spend(p_status text)
returns boolean language sql immutable
as $$ select p_status in ('submitting', 'queued', 'in_progress', 'completed') $$;

-- Aggregated usage for a team since a date. Owners/admins see everyone;
-- members only see their own rows.
create or replace function public.team_usage(p_team uuid, p_since timestamptz)
returns table (
  day date, user_id uuid, email text, model_id text, project_id uuid, project_name text,
  jobs bigint, failed bigint, credits numeric
)
language sql stable security definer set search_path = public
as $$
  select
    (j.created_at at time zone 'utc')::date as day,
    j.user_id,
    pr.email,
    j.model_id,
    j.project_id,
    p.name,
    count(*) as jobs,
    count(*) filter (where j.status in ('failed', 'nsfw', 'error')) as failed,
    coalesce(sum(j.cost) filter (where public.job_counts_as_spend(j.status)), 0) as credits
  from public.jobs j
  left join public.profiles pr on pr.id = j.user_id
  left join public.projects p on p.id = j.project_id
  where j.team_id = p_team
    and j.created_at >= p_since
    and public.is_team_member(p_team)
    and (j.user_id = auth.uid() or public.has_team_role(p_team, array['owner', 'admin']::public.team_role[]))
  group by 1, 2, 3, 4, 5, 6;
$$;

-- What a new submit must fit in: team spend this month vs budget, and the
-- caller's spend today vs their daily cap.
create or replace function public.spend_status(p_team uuid)
returns table (month_spent numeric, monthly_budget numeric, today_spent numeric, daily_cap numeric)
language sql stable security definer set search_path = public
as $$
  select
    coalesce((select sum(cost) from public.jobs
              where team_id = p_team and public.job_counts_as_spend(status)
                and created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc'), 0),
    t.monthly_budget,
    coalesce((select sum(cost) from public.jobs
              where team_id = p_team and user_id = auth.uid() and public.job_counts_as_spend(status)
                and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'), 0),
    m.daily_cap
  from public.teams t
  join public.team_members m on m.team_id = t.id and m.user_id = auth.uid()
  where t.id = p_team;
$$;

revoke execute on function public.team_members_list(uuid) from anon;
revoke execute on function public.add_team_member(uuid, text, public.team_role) from anon;
revoke execute on function public.update_team_member(uuid, uuid, public.team_role, numeric) from anon;
revoke execute on function public.remove_team_member(uuid, uuid) from anon;
revoke execute on function public.team_usage(uuid, timestamptz) from anon;
revoke execute on function public.spend_status(uuid) from anon;
