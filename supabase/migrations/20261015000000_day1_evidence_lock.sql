-- Phase 1: Day-1 Evidence Lock.
--
-- Evidence rows are now written only by the server, using the service role,
-- after it has downloaded the uploaded file and hashed it itself. Users can
-- read, relink and delete their own evidence, but never set or change a hash,
-- a size, a path or the verification state.

-- Check-ins: a location may come from the device (lat/lng) or be typed in.
alter table public.events
  add column location_label text check (char_length(location_label) <= 300),
  add column location_accuracy_m double precision check (location_accuracy_m >= 0),
  add column location_source text check (location_source in ('device', 'manual'));

alter table public.evidence
  add column original_name text check (char_length(original_name) <= 255),
  -- Set when the server's own hash of the stored file matched the hash the
  -- browser computed before upload.
  add column hash_verified_at timestamptz,
  -- Result of the most recent re-check of the stored file against sha256.
  add column last_checked_at timestamptz,
  add column last_check_ok boolean;

-- Column-level privileges: users may only move evidence between entries.
revoke insert, update on public.evidence from authenticated;
grant update (event_id) on public.evidence to authenticated;

-- Evidence and the entry it is attached to must be in the same case. Runs as
-- the caller, so another user's events are invisible and fail the check too.
create function public.evidence_event_same_case()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.event_id is not null and not exists (
    select 1 from public.events e where e.id = new.event_id and e.case_id = new.case_id
  ) then
    raise exception 'evidence and its entry must belong to the same case';
  end if;
  return new;
end;
$$;

create trigger evidence_event_same_case
  before insert or update of event_id, case_id on public.evidence
  for each row execute function public.evidence_event_same_case();

-- Evidence bucket limits: 25 MiB, photos and documents only for now.
update storage.buckets
set
  file_size_limit = 26214400,
  allowed_mime_types = array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'
  ]
where id = 'evidence';
