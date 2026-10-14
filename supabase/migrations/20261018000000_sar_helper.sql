-- Phase 4: subject access request helper.
--
-- Saved contacts (per user), richer SAR records (the letter as generated,
-- sent and received dates), logged responses, and reminders linked to a SAR.
-- Reminder emails are sent by the server, which alone can mark them sent.

-- ---------------------------------------------------------------------------
-- Saved contacts
-- ---------------------------------------------------------------------------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 300),
  address text check (char_length(address) <= 1000),
  email text check (char_length(email) <= 320),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now()
);

create index contacts_user_id_idx on public.contacts (user_id);

alter table public.contacts enable row level security;

create policy contacts_select_own on public.contacts
  for select to authenticated using (user_id = (select auth.uid()));
create policy contacts_insert_own on public.contacts
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy contacts_update_own on public.contacts
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy contacts_delete_own on public.contacts
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.contacts from anon;

-- ---------------------------------------------------------------------------
-- SAR requests
-- ---------------------------------------------------------------------------
alter table public.sar_requests
  add column contact_id uuid references public.contacts (id) on delete set null,
  add column recipient_address text check (char_length(recipient_address) <= 1000),
  add column recipient_email text check (char_length(recipient_email) <= 320),
  add column date_from date,
  add column date_to date,
  add column response_format text not null default 'electronic' check (response_format in ('electronic', 'paper')),
  -- The identifying details the user chose to include, as entered.
  add column requester jsonb not null default '{}'::jsonb,
  -- The letter exactly as generated when the user saved it.
  add column letter_text text check (char_length(letter_text) <= 50000),
  add column sent_method text check (sent_method in ('email', 'post', 'online_form', 'other')),
  -- When the organisation received it, if the user knows. The time limit starts here.
  add column received_on date,
  add column event_id uuid references public.events (id) on delete set null,
  add column updated_at timestamptz not null default now(),
  add constraint sar_requests_date_range check (date_to is null or date_from is null or date_to >= date_from),
  add constraint sar_requests_received_after_sent check (received_on is null or sent_on is null or received_on >= sent_on);

create function public.sar_requests_check_contact()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Runs as the caller, so another user's contacts are invisible here.
  if new.contact_id is not null and not exists (select 1 from public.contacts where id = new.contact_id) then
    raise exception 'that contact was not found';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger sar_requests_check_contact
  before insert or update on public.sar_requests
  for each row execute function public.sar_requests_check_contact();

-- ---------------------------------------------------------------------------
-- Responses
-- ---------------------------------------------------------------------------
create table public.sar_responses (
  id uuid primary key default gen_random_uuid(),
  sar_request_id uuid not null references public.sar_requests (id) on delete cascade,
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  received_on date not null,
  description text check (char_length(description) <= 5000),
  -- Timeline entry holding any files received.
  event_id uuid references public.events (id) on delete set null,
  created_at timestamptz not null default now()
);

create index sar_responses_sar_request_id_idx on public.sar_responses (sar_request_id);

create function public.sar_responses_fill()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  r_case uuid;
  r_user uuid;
begin
  select s.case_id, s.user_id into r_case, r_user from public.sar_requests s where s.id = new.sar_request_id;
  if r_case is null then
    raise exception 'that request was not found';
  end if;
  new.case_id := r_case;
  new.user_id := r_user;
  return new;
end;
$$;

create trigger sar_responses_fill
  before insert or update on public.sar_responses
  for each row execute function public.sar_responses_fill();

alter table public.sar_responses enable row level security;

create policy sar_responses_select_own on public.sar_responses
  for select to authenticated using (user_id = (select auth.uid()));
create policy sar_responses_insert_own on public.sar_responses
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy sar_responses_update_own on public.sar_responses
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy sar_responses_delete_own on public.sar_responses
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.sar_responses from anon;

create trigger audit_sar_responses after insert or update or delete on public.sar_responses
  for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------
-- Reminders
-- ---------------------------------------------------------------------------
alter table public.reminders
  add column sar_request_id uuid references public.sar_requests (id) on delete cascade,
  add constraint reminders_one_per_kind unique (sar_request_id, kind);

create index reminders_due_idx on public.reminders (due_at) where sent_at is null;

create function public.reminders_check_case()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.sar_request_id is not null and not exists (
    select 1 from public.sar_requests s where s.id = new.sar_request_id and s.case_id = new.case_id
  ) then
    raise exception 'a reminder and its request must belong to the same case';
  end if;
  return new;
end;
$$;

create trigger reminders_check_case
  before insert on public.reminders
  for each row execute function public.reminders_check_case();

-- Users create and cancel reminders; only the server (service role) marks them sent.
revoke update on public.reminders from authenticated;
