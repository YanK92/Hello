-- Phase 6: launch hardening.

-- ---------------------------------------------------------------------------
-- Per-user rate limits (fixed windows). The subject is always the caller's
-- own auth.uid(), so one user cannot use up another's allowance.
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  user_id uuid not null,
  action text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (user_id, action, window_start)
);

create index rate_limits_window_idx on public.rate_limits (window_start);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

create function public.rate_limit(p_action text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  bucket timestamptz;
  count_now integer;
begin
  if uid is null then
    return false;
  end if;
  if p_action is null or char_length(p_action) not between 1 and 50
     or p_limit is null or p_limit < 1 or p_window_seconds is null or p_window_seconds not between 1 and 86400 then
    raise exception 'invalid rate limit arguments';
  end if;

  bucket := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits as r (user_id, action, window_start, hits)
  values (uid, p_action, bucket, 1)
  on conflict (user_id, action, window_start) do update set hits = r.hits + 1
  returning hits into count_now;

  -- Occasional tidy-up of old windows.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '2 days';
  end if;

  return count_now <= p_limit;
end;
$$;

revoke execute on function public.rate_limit(text, integer, integer) from public, anon;
grant execute on function public.rate_limit(text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Account erasure: audit rows stay append-only while the account exists, and
-- can be removed only once the account itself has been deleted.
-- ---------------------------------------------------------------------------
create or replace function public.audit_log_block_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from auth.users where id = old.user_id) then
    return old;
  end if;
  raise exception 'audit_log is append-only';
end;
$$;
