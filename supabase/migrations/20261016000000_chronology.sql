-- Phase 2: chronology builder.
--
-- Entries (public.events) gain a short title and "who was involved", keep a
-- full edit history in event_revisions, and can link to any evidence in the
-- same case through event_evidence.

alter table public.events
  add column title text check (char_length(title) <= 200),
  add column who text check (char_length(who) <= 200),
  add column edited_at timestamptz;

-- ---------------------------------------------------------------------------
-- Edit history
-- ---------------------------------------------------------------------------
-- event_id has no foreign key so history survives the entry being deleted.
-- Deleting the whole case (or the account) removes it via case_id/user_id.
create table public.event_revisions (
  id bigint generated always as identity primary key,
  event_id uuid not null,
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  revision integer not null,
  op text not null check (op in ('update', 'delete')),
  -- The entry as it was before this change.
  snapshot jsonb not null,
  changed_at timestamptz not null default now(),
  unique (event_id, revision)
);

create index event_revisions_event_id_idx on public.event_revisions (event_id);

alter table public.event_revisions enable row level security;

create policy event_revisions_select_own on public.event_revisions
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.event_revisions from anon, authenticated;
grant select on public.event_revisions to authenticated;

create function public.record_event_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_revision integer;
begin
  -- The entry is going because its whole case is being deleted: there is no
  -- case left to keep history for.
  if tg_op = 'DELETE' and not exists (select 1 from public.cases where id = old.case_id) then
    return old;
  end if;

  select coalesce(max(revision), 0) + 1 into next_revision
  from public.event_revisions where event_id = old.id;

  insert into public.event_revisions (event_id, case_id, user_id, revision, op, snapshot)
  values (old.id, old.case_id, old.user_id, next_revision, lower(tg_op), to_jsonb(old));

  if tg_op = 'DELETE' then
    return old;
  end if;
  new.edited_at := now();
  return new;
end;
$$;

create trigger events_record_revision
  before update or delete on public.events
  for each row execute function public.record_event_revision();

-- ---------------------------------------------------------------------------
-- Entry <-> evidence links
-- ---------------------------------------------------------------------------
create table public.event_evidence (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  evidence_id uuid not null references public.evidence (id) on delete cascade,
  -- Filled in by trigger from the entry, so policies can check ownership.
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, evidence_id)
);

create index event_evidence_evidence_id_idx on public.event_evidence (evidence_id);

create function public.event_evidence_fill_and_check()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  entry_case uuid;
  entry_user uuid;
  evidence_case uuid;
begin
  -- Runs as the caller, so another user's rows are invisible here.
  select e.case_id, e.user_id into entry_case, entry_user from public.events e where e.id = new.event_id;
  select v.case_id into evidence_case from public.evidence v where v.id = new.evidence_id;
  if entry_case is null or evidence_case is null or entry_case <> evidence_case then
    raise exception 'an entry can only link to evidence in the same case';
  end if;
  new.case_id := entry_case;
  new.user_id := entry_user;
  return new;
end;
$$;

create trigger event_evidence_fill_and_check
  before insert or update on public.event_evidence
  for each row execute function public.event_evidence_fill_and_check();

alter table public.event_evidence enable row level security;

create policy event_evidence_select_own on public.event_evidence
  for select to authenticated using (user_id = (select auth.uid()));
create policy event_evidence_insert_own on public.event_evidence
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.owns_case(case_id));
create policy event_evidence_delete_own on public.event_evidence
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.event_evidence from anon;
revoke update on public.event_evidence from authenticated;

create trigger audit_event_evidence after insert or update or delete on public.event_evidence
  for each row execute function public.audit_row_change();
