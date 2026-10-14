-- Evidence Locker: core schema, row level security and append-only audit log.
--
-- Every user-owned table carries user_id and is locked to auth.uid() by RLS.
-- Child tables also check that the referenced case belongs to the same user,
-- so a user cannot attach rows to someone else's case even by guessing ids.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  terms_accepted_at timestamptz,
  recording_notice_ack_at timestamptz,
  email_reminders_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create a profile row whenever a user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- cases
-- ---------------------------------------------------------------------------
create type public.case_status as enum ('open', 'closed', 'archived');

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  item_description text check (char_length(item_description) <= 2000),
  trader_name text check (char_length(trader_name) <= 200),
  finance_provider text check (char_length(finance_provider) <= 200),
  agreement_reference text check (char_length(agreement_reference) <= 200),
  status public.case_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cases_user_id_idx on public.cases (user_id);

-- ---------------------------------------------------------------------------
-- events (chronology entries)
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (char_length(type) between 1 and 50),
  occurred_at timestamptz not null,
  -- Server-side timestamp; clients cannot choose it.
  recorded_at timestamptz not null default now(),
  notes text check (char_length(notes) <= 10000),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  created_at timestamptz not null default now()
);

create index events_case_id_idx on public.events (case_id);

-- ---------------------------------------------------------------------------
-- evidence (file metadata; bytes live in the private storage bucket)
-- ---------------------------------------------------------------------------
create type public.evidence_source as enum ('photo', 'audio', 'doc', 'email');

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  event_id uuid references public.events (id) on delete set null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  storage_path text not null unique,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  mime text not null,
  size bigint not null check (size >= 0),
  source public.evidence_source not null,
  uploaded_at timestamptz not null default now()
);

create index evidence_case_id_idx on public.evidence (case_id);

-- ---------------------------------------------------------------------------
-- transcripts
-- ---------------------------------------------------------------------------
create table public.transcripts (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.evidence (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text text not null,
  segments jsonb not null default '[]'::jsonb,
  model text,
  created_at timestamptz not null default now()
);

create index transcripts_evidence_id_idx on public.transcripts (evidence_id);

-- ---------------------------------------------------------------------------
-- sar_requests
-- ---------------------------------------------------------------------------
create type public.sar_status as enum ('draft', 'sent', 'response_received', 'closed');

create table public.sar_requests (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipient text not null check (char_length(recipient) between 1 and 300),
  items_selected text[] not null default '{}',
  sent_on date,
  due_on date,
  status public.sar_status not null default 'draft',
  created_at timestamptz not null default now()
);

create index sar_requests_case_id_idx on public.sar_requests (case_id);

-- ---------------------------------------------------------------------------
-- reminders
-- ---------------------------------------------------------------------------
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  due_at timestamptz not null,
  kind text not null check (char_length(kind) between 1 and 50),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index reminders_case_id_idx on public.reminders (case_id);

-- ---------------------------------------------------------------------------
-- audit_log (append-only)
-- ---------------------------------------------------------------------------
-- user_id deliberately has no foreign key: the log must outlive the rows it
-- describes. Retention is handled by the Phase 6 retention policy.
create table public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  action text not null,
  entity text not null,
  entity_id uuid,
  hash text not null,
  ts timestamptz not null default now()
);

create index audit_log_user_id_idx on public.audit_log (user_id);

create function public.audit_log_block_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only';
end;
$$;

create trigger audit_log_no_update_delete
  before update or delete on public.audit_log
  for each row execute function public.audit_log_block_mutation();

create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function public.audit_log_block_mutation();

-- Writes an audit row for every insert/update/delete on audited tables. The
-- hash is SHA-256 of the row as JSON after the change (before, for deletes).
create function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec jsonb;
begin
  if tg_op = 'DELETE' then
    rec := to_jsonb(old);
  else
    rec := to_jsonb(new);
  end if;

  insert into public.audit_log (user_id, action, entity, entity_id, hash)
  values (
    (rec ->> 'user_id')::uuid,
    lower(tg_op),
    tg_table_name,
    (rec ->> 'id')::uuid,
    encode(extensions.digest(rec::text, 'sha256'), 'hex')
  );

  return null;
end;
$$;

create trigger audit_cases after insert or update or delete on public.cases
  for each row execute function public.audit_row_change();
create trigger audit_events after insert or update or delete on public.events
  for each row execute function public.audit_row_change();
create trigger audit_evidence after insert or update or delete on public.evidence
  for each row execute function public.audit_row_change();
create trigger audit_sar_requests after insert or update or delete on public.sar_requests
  for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger cases_updated_at before update on public.cases
  for each row execute function public.set_updated_at();

-- Server-side timestamps cannot be overwritten by clients.
create function public.protect_server_timestamps()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'events' then
    new.recorded_at := old.recorded_at;
  elsif tg_table_name = 'evidence' then
    new.uploaded_at := old.uploaded_at;
  end if;
  new.user_id := old.user_id;
  return new;
end;
$$;

create trigger events_protect_timestamps before update on public.events
  for each row execute function public.protect_server_timestamps();
create trigger evidence_protect_timestamps before update on public.evidence
  for each row execute function public.protect_server_timestamps();

create function public.force_server_timestamp_on_insert()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'events' then
    new.recorded_at := now();
  elsif tg_table_name = 'evidence' then
    new.uploaded_at := now();
  end if;
  return new;
end;
$$;

create trigger events_insert_timestamp before insert on public.events
  for each row execute function public.force_server_timestamp_on_insert();
create trigger evidence_insert_timestamp before insert on public.evidence
  for each row execute function public.force_server_timestamp_on_insert();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.cases enable row level security;
alter table public.events enable row level security;
alter table public.evidence enable row level security;
alter table public.transcripts enable row level security;
alter table public.sar_requests enable row level security;
alter table public.reminders enable row level security;
alter table public.audit_log enable row level security;

-- profiles: read and update own row only. Rows are created by the trigger.
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- cases: full CRUD on own rows.
create policy cases_select_own on public.cases
  for select to authenticated using (user_id = (select auth.uid()));
create policy cases_insert_own on public.cases
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy cases_update_own on public.cases
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy cases_delete_own on public.cases
  for delete to authenticated using (user_id = (select auth.uid()));

-- Helper: does the current user own this case? Runs as definer so it is not
-- itself filtered by RLS, and only ever compares against auth.uid().
create function public.owns_case(p_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cases c
    where c.id = p_case_id and c.user_id = (select auth.uid())
  );
$$;

-- Child tables of cases: own rows only, and the parent case must be owned.
do $$
declare
  t text;
begin
  foreach t in array array['events', 'evidence', 'sar_requests', 'reminders'] loop
    execute format(
      'create policy %1$s_select_own on public.%1$I for select to authenticated
         using (user_id = (select auth.uid()))', t);
    execute format(
      'create policy %1$s_insert_own on public.%1$I for insert to authenticated
         with check (user_id = (select auth.uid()) and public.owns_case(case_id))', t);
    execute format(
      'create policy %1$s_update_own on public.%1$I for update to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()) and public.owns_case(case_id))', t);
    execute format(
      'create policy %1$s_delete_own on public.%1$I for delete to authenticated
         using (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- transcripts hang off evidence.
create function public.owns_evidence(p_evidence_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.evidence e
    where e.id = p_evidence_id and e.user_id = (select auth.uid())
  );
$$;

create policy transcripts_select_own on public.transcripts
  for select to authenticated using (user_id = (select auth.uid()));
create policy transcripts_insert_own on public.transcripts
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.owns_evidence(evidence_id));
create policy transcripts_update_own on public.transcripts
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_evidence(evidence_id));
create policy transcripts_delete_own on public.transcripts
  for delete to authenticated using (user_id = (select auth.uid()));

-- audit_log: users may read their own entries. There are no insert, update
-- or delete policies: rows are written only by the security definer trigger.
create policy audit_log_select_own on public.audit_log
  for select to authenticated using (user_id = (select auth.uid()));

-- Anonymous users get nothing.
revoke all on all tables in schema public from anon;
revoke all on public.audit_log from authenticated;
grant select on public.audit_log to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private evidence bucket, objects stored under "<user_id>/..."
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict (id) do nothing;

create policy evidence_objects_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy evidence_objects_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- Evidence files are immutable once uploaded: no update policy.
create policy evidence_objects_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);
