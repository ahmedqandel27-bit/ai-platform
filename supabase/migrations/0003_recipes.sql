-- ─────────────────────────────────────────────────────────────
-- Phase 5: Super Computer recipes (saved, reusable pipelines).
-- ─────────────────────────────────────────────────────────────

create table public.recipes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  -- Validated plan: { title, steps[] } (see lib/supercomputer/plan.ts).
  plan        jsonb not null,
  created_at  timestamptz not null default now()
);

create index recipes_user_created_idx on public.recipes (user_id, created_at desc);

alter table public.recipes enable row level security;

create policy "recipes_select_own" on public.recipes for select using (user_id = auth.uid());
create policy "recipes_insert_own" on public.recipes for insert with check (user_id = auth.uid());
create policy "recipes_update_own" on public.recipes for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "recipes_delete_own" on public.recipes for delete using (user_id = auth.uid());
