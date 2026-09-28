-- ─────────────────────────────────────────────────────────────
-- Phase 2: generations (jobs) + private output storage.
-- Every Higgsfield request_id is stored with the user who created it;
-- the app only serves status / results / cancel for ids found here.
-- ─────────────────────────────────────────────────────────────

create table public.jobs (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  -- Client-generated id; also the idempotency key (unique per user).
  client_id            text not null,
  provider_request_id  text unique,
  surface              text not null check (surface in ('image', 'video')),
  model_id             text not null,
  platform_path        text not null,
  prompt               text not null default '',
  settings             jsonb not null default '{}'::jsonb,
  media                jsonb not null default '[]'::jsonb,
  input_mode           text,
  status               text not null default 'submitting'
    check (status in ('submitting', 'queued', 'in_progress', 'completed', 'failed', 'nsfw', 'canceled', 'error')),
  outputs              jsonb,
  -- Paths inside the `outputs` bucket once media has been copied.
  storage_paths        text[],
  error                jsonb,
  -- Credits spent (filled once cost reporting is wired up).
  cost                 numeric(12, 4),
  created_at           timestamptz not null default now(),
  finished_at          timestamptz,
  unique (user_id, client_id)
);

create index jobs_user_created_idx on public.jobs (user_id, created_at desc);

alter table public.jobs enable row level security;

create policy "jobs_select_own" on public.jobs for select using (user_id = auth.uid());
create policy "jobs_insert_own" on public.jobs for insert with check (user_id = auth.uid());
create policy "jobs_update_own" on public.jobs for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "jobs_delete_own" on public.jobs for delete using (user_id = auth.uid());

-- ─── Storage: private bucket, one folder per user ─────────────

insert into storage.buckets (id, name, public)
values ('outputs', 'outputs', false)
on conflict (id) do nothing;

create policy "outputs_select_own" on storage.objects for select
  using (bucket_id = 'outputs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "outputs_insert_own" on storage.objects for insert
  with check (bucket_id = 'outputs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "outputs_update_own" on storage.objects for update
  using (bucket_id = 'outputs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "outputs_delete_own" on storage.objects for delete
  using (bucket_id = 'outputs' and (storage.foldername(name))[1] = auth.uid()::text);
