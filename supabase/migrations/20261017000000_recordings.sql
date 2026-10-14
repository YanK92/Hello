-- Phase 3: call recordings and transcripts.
--
-- Recordings are audio evidence (same upload and hash checks as photos).
-- Each recording can have one transcript, from a transcription provider or
-- imported by the user, searchable with Postgres full-text search. Users can
-- highlight transcript segments and add their own notes. Nothing is analysed
-- automatically.

update storage.buckets
set
  file_size_limit = 104857600,
  allowed_mime_types = array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf',
    'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav',
    'audio/webm', 'audio/ogg'
  ]
where id = 'evidence';

-- ---------------------------------------------------------------------------
-- Transcripts
-- ---------------------------------------------------------------------------
alter table public.transcripts
  add column case_id uuid references public.cases (id) on delete cascade,
  add column status text not null default 'done'
    check (status in ('pending', 'processing', 'done', 'failed')),
  add column source text not null default 'import' check (source in ('provider', 'import')),
  add column error text check (char_length(error) <= 500),
  add column updated_at timestamptz not null default now(),
  add column fts tsvector generated always as (to_tsvector('english', coalesce(text, ''))) stored,
  add constraint transcripts_one_per_recording unique (evidence_id);

alter table public.transcripts alter column text set default '';

create index transcripts_fts_idx on public.transcripts using gin (fts);
create index transcripts_case_id_idx on public.transcripts (case_id);

-- Fill case_id from the recording and check it is audio. Runs as the
-- caller, so another user's evidence is invisible and fails the check.
create function public.transcripts_fill_and_check()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  rec_case uuid;
  rec_user uuid;
  rec_source public.evidence_source;
begin
  select e.case_id, e.user_id, e.source into rec_case, rec_user, rec_source
  from public.evidence e where e.id = new.evidence_id;
  if rec_case is null or rec_source <> 'audio' then
    raise exception 'a transcript must belong to one of your recordings';
  end if;
  new.case_id := rec_case;
  new.user_id := rec_user;
  new.updated_at := now();
  return new;
end;
$$;

create trigger transcripts_fill_and_check
  before insert or update on public.transcripts
  for each row execute function public.transcripts_fill_and_check();

alter table public.transcripts alter column case_id set not null;

create trigger audit_transcripts after insert or update or delete on public.transcripts
  for each row execute function public.audit_row_change();

-- Search within one case. Security invoker, so RLS limits results to the
-- caller's own transcripts whatever case id they pass.
create function public.search_transcripts(p_case_id uuid, p_query text)
returns table (transcript_id uuid, evidence_id uuid, headline text, rank real)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    t.id,
    t.evidence_id,
    pg_catalog.ts_headline(
      'english', t.text, q,
      'StartSel=<mark>, StopSel=</mark>, MaxFragments=3, MaxWords=18, MinWords=6, FragmentDelimiter=" … "'
    ),
    pg_catalog.ts_rank(t.fts, q)
  from public.transcripts t,
       pg_catalog.websearch_to_tsquery('english', p_query) as q
  where t.case_id = p_case_id and t.fts @@ q
  order by 4 desc
  limit 50;
$$;

revoke execute on function public.search_transcripts(uuid, text) from anon;

-- ---------------------------------------------------------------------------
-- Highlights and notes
-- ---------------------------------------------------------------------------
create table public.transcript_highlights (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null references public.transcripts (id) on delete cascade,
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  start_segment integer not null check (start_segment >= 0),
  end_segment integer not null,
  -- The highlighted words as they were when highlighted.
  quote text not null check (char_length(quote) <= 5000),
  note text check (char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  check (end_segment >= start_segment)
);

create index transcript_highlights_transcript_id_idx on public.transcript_highlights (transcript_id);

create function public.transcript_highlights_fill()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  t_case uuid;
  t_user uuid;
begin
  select t.case_id, t.user_id into t_case, t_user from public.transcripts t where t.id = new.transcript_id;
  if t_case is null then
    raise exception 'that transcript was not found';
  end if;
  new.case_id := t_case;
  new.user_id := t_user;
  return new;
end;
$$;

create trigger transcript_highlights_fill
  before insert or update on public.transcript_highlights
  for each row execute function public.transcript_highlights_fill();

alter table public.transcript_highlights enable row level security;

create policy transcript_highlights_select_own on public.transcript_highlights
  for select to authenticated using (user_id = (select auth.uid()));
create policy transcript_highlights_insert_own on public.transcript_highlights
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy transcript_highlights_update_own on public.transcript_highlights
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy transcript_highlights_delete_own on public.transcript_highlights
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.transcript_highlights from anon;

create trigger audit_transcript_highlights after insert or update or delete on public.transcript_highlights
  for each row execute function public.audit_row_change();
