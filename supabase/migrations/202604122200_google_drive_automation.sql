create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.pipelines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  pipeline_steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists pipelines_user_id_updated_at_idx
  on public.pipelines (user_id, updated_at desc);

drop trigger if exists pipelines_set_updated_at on public.pipelines;
create trigger pipelines_set_updated_at
before update on public.pipelines
for each row
execute function public.set_updated_at();

create table if not exists public.google_drive_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  google_account_id text not null,
  email text not null,
  encrypted_refresh_token text not null,
  scopes text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, google_account_id)
);

create index if not exists google_drive_connections_user_id_idx
  on public.google_drive_connections (user_id, updated_at desc);

drop trigger if exists google_drive_connections_set_updated_at on public.google_drive_connections;
create trigger google_drive_connections_set_updated_at
before update on public.google_drive_connections
for each row
execute function public.set_updated_at();

create table if not exists public.drive_automations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  connection_id uuid not null references public.google_drive_connections(id) on delete cascade,
  pipeline_id uuid not null references public.pipelines(id) on delete cascade,
  source_folder_id text not null,
  output_folder_id text not null,
  file_name_pattern text,
  mime_type_filter text[] not null default '{}',
  enabled boolean not null default true,
  last_scan_at timestamptz,
  last_cursor text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists drive_automations_user_id_updated_at_idx
  on public.drive_automations (user_id, updated_at desc);

drop trigger if exists drive_automations_set_updated_at on public.drive_automations;
create trigger drive_automations_set_updated_at
before update on public.drive_automations
for each row
execute function public.set_updated_at();

create table if not exists public.drive_file_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.drive_automations(id) on delete cascade,
  drive_file_id text not null,
  drive_revision_id text not null,
  drive_modified_time timestamptz,
  source_storage_path text,
  source_file_name text,
  job_id uuid,
  result_paths jsonb not null default '[]'::jsonb,
  exported_drive_file_id text,
  exported_drive_file_name text,
  status text not null default 'discovered',
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (automation_id, drive_file_id, drive_revision_id),
  constraint drive_file_runs_status_check
    check (
      status in (
        'discovered',
        'queued',
        'processing',
        'awaiting_export',
        'exporting',
        'completed',
        'error',
        'export_error'
      )
    )
);

create index if not exists drive_file_runs_automation_id_updated_at_idx
  on public.drive_file_runs (automation_id, updated_at desc);

create index if not exists drive_file_runs_job_id_idx
  on public.drive_file_runs (job_id);

drop trigger if exists drive_file_runs_set_updated_at on public.drive_file_runs;
create trigger drive_file_runs_set_updated_at
before update on public.drive_file_runs
for each row
execute function public.set_updated_at();

alter table public.pipelines enable row level security;
alter table public.google_drive_connections enable row level security;
alter table public.drive_automations enable row level security;
alter table public.drive_file_runs enable row level security;

drop policy if exists "pipelines_select_own" on public.pipelines;
create policy "pipelines_select_own"
on public.pipelines
for select
using (auth.uid() = user_id);

drop policy if exists "pipelines_insert_own" on public.pipelines;
create policy "pipelines_insert_own"
on public.pipelines
for insert
with check (auth.uid() = user_id);

drop policy if exists "pipelines_update_own" on public.pipelines;
create policy "pipelines_update_own"
on public.pipelines
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "pipelines_delete_own" on public.pipelines;
create policy "pipelines_delete_own"
on public.pipelines
for delete
using (auth.uid() = user_id);

drop policy if exists "google_drive_connections_select_own" on public.google_drive_connections;
create policy "google_drive_connections_select_own"
on public.google_drive_connections
for select
using (auth.uid() = user_id);

drop policy if exists "google_drive_connections_insert_own" on public.google_drive_connections;
create policy "google_drive_connections_insert_own"
on public.google_drive_connections
for insert
with check (auth.uid() = user_id);

drop policy if exists "google_drive_connections_update_own" on public.google_drive_connections;
create policy "google_drive_connections_update_own"
on public.google_drive_connections
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "google_drive_connections_delete_own" on public.google_drive_connections;
create policy "google_drive_connections_delete_own"
on public.google_drive_connections
for delete
using (auth.uid() = user_id);

drop policy if exists "drive_automations_select_own" on public.drive_automations;
create policy "drive_automations_select_own"
on public.drive_automations
for select
using (auth.uid() = user_id);

drop policy if exists "drive_automations_insert_own" on public.drive_automations;
create policy "drive_automations_insert_own"
on public.drive_automations
for insert
with check (auth.uid() = user_id);

drop policy if exists "drive_automations_update_own" on public.drive_automations;
create policy "drive_automations_update_own"
on public.drive_automations
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "drive_automations_delete_own" on public.drive_automations;
create policy "drive_automations_delete_own"
on public.drive_automations
for delete
using (auth.uid() = user_id);

drop policy if exists "drive_file_runs_select_own" on public.drive_file_runs;
create policy "drive_file_runs_select_own"
on public.drive_file_runs
for select
using (
  exists (
    select 1
    from public.drive_automations automation
    where automation.id = drive_file_runs.automation_id
      and automation.user_id = auth.uid()
  )
);

drop policy if exists "drive_file_runs_insert_own" on public.drive_file_runs;
create policy "drive_file_runs_insert_own"
on public.drive_file_runs
for insert
with check (
  exists (
    select 1
    from public.drive_automations automation
    where automation.id = drive_file_runs.automation_id
      and automation.user_id = auth.uid()
  )
);

drop policy if exists "drive_file_runs_update_own" on public.drive_file_runs;
create policy "drive_file_runs_update_own"
on public.drive_file_runs
for update
using (
  exists (
    select 1
    from public.drive_automations automation
    where automation.id = drive_file_runs.automation_id
      and automation.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.drive_automations automation
    where automation.id = drive_file_runs.automation_id
      and automation.user_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public)
values ('pipeline-assets', 'pipeline-assets', false)
on conflict (id) do nothing;
