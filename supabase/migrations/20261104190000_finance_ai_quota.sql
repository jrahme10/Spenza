create table if not exists public.finance_ai_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default (now() at time zone 'utc')::date,
  request_count integer not null default 0 check (request_count >= 0),
  last_request_at timestamptz,
  primary key (user_id, usage_date)
);

alter table public.finance_ai_daily_usage enable row level security;
revoke all on public.finance_ai_daily_usage from anon, authenticated;

create or replace function public.consume_finance_ai_quota()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  allowed boolean := false;
begin
  if current_user_id is null then return false; end if;
  insert into public.finance_ai_daily_usage (user_id, usage_date, request_count, last_request_at)
  values (current_user_id, (now() at time zone 'utc')::date, 1, now())
  on conflict (user_id, usage_date) do update
    set request_count = public.finance_ai_daily_usage.request_count + 1,
        last_request_at = now()
    where public.finance_ai_daily_usage.request_count < 20
      and (public.finance_ai_daily_usage.last_request_at is null
        or public.finance_ai_daily_usage.last_request_at < now() - interval '2 seconds')
  returning true into allowed;
  return coalesce(allowed, false);
end;
$$;

revoke all on function public.consume_finance_ai_quota() from public, anon;
grant execute on function public.consume_finance_ai_quota() to authenticated;
