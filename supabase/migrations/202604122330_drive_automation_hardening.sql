alter table public.drive_automations
drop constraint if exists drive_automations_distinct_folders_check;

alter table public.drive_automations
add constraint drive_automations_distinct_folders_check
check (source_folder_id <> output_folder_id);

create index if not exists drive_file_runs_status_updated_at_idx
  on public.drive_file_runs (status, updated_at asc);
