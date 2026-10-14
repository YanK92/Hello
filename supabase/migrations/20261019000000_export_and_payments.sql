-- Phase 5: bundle export, side-by-side document notes, and payments.

-- ---------------------------------------------------------------------------
-- Document notes (side-by-side viewer). The user's own notes only.
-- ---------------------------------------------------------------------------
create table public.document_notes (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.evidence (id) on delete cascade,
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  page integer check (page >= 1),
  note text not null check (char_length(note) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index document_notes_evidence_id_idx on public.document_notes (evidence_id);

create function public.document_notes_fill()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  e_case uuid;
  e_user uuid;
begin
  -- Runs as the caller, so another user's documents are invisible here.
  select e.case_id, e.user_id into e_case, e_user from public.evidence e where e.id = new.evidence_id;
  if e_case is null then
    raise exception 'that document was not found';
  end if;
  new.case_id := e_case;
  new.user_id := e_user;
  return new;
end;
$$;

create trigger document_notes_fill
  before insert or update on public.document_notes
  for each row execute function public.document_notes_fill();

alter table public.document_notes enable row level security;

create policy document_notes_select_own on public.document_notes
  for select to authenticated using (user_id = (select auth.uid()));
create policy document_notes_insert_own on public.document_notes
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy document_notes_update_own on public.document_notes
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy document_notes_delete_own on public.document_notes
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.document_notes from anon;

-- ---------------------------------------------------------------------------
-- Paid access. Written only by the server from verified Stripe webhooks.
-- ---------------------------------------------------------------------------
create table public.entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null check (plan in ('paid')),
  source text not null check (source in ('stripe', 'manual')),
  stripe_customer_id text,
  stripe_checkout_session_id text,
  stripe_subscription_id text,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table public.entitlements enable row level security;

create policy entitlements_select_own on public.entitlements
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.entitlements from anon, authenticated;
grant select on public.entitlements to authenticated;

create function public.has_paid_access()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.entitlements
    where user_id = (select auth.uid()) and revoked_at is null
  );
$$;

-- Stripe webhook events already handled, so retries are processed once.
create table public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from anon, authenticated;
