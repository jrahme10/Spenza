-- Spenza cloud sync schema. Local IndexedDB remains the offline source of truth.

create table if not exists public.spenza_wallets (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  payload jsonb not null,
  changed_at timestamptz not null,
  primary key (owner_id, id)
);

create table if not exists public.spenza_transactions (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  payload jsonb not null,
  changed_at timestamptz not null,
  primary key (owner_id, id)
);

create table if not exists public.spenza_bills (
  owner_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  payload jsonb not null,
  changed_at timestamptz not null,
  primary key (owner_id, id)
);

create table if not exists public.spenza_tombstones (
  owner_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('wallet','transaction','bill')),
  entity_id text not null,
  deleted_at timestamptz not null,
  primary key (owner_id, entity_type, entity_id)
);

create index if not exists spenza_wallets_changed_idx on public.spenza_wallets(owner_id, changed_at);
create index if not exists spenza_transactions_changed_idx on public.spenza_transactions(owner_id, changed_at);
create index if not exists spenza_bills_changed_idx on public.spenza_bills(owner_id, changed_at);
create index if not exists spenza_tombstones_changed_idx on public.spenza_tombstones(owner_id, deleted_at);

alter table public.spenza_wallets enable row level security;
alter table public.spenza_transactions enable row level security;
alter table public.spenza_bills enable row level security;
alter table public.spenza_tombstones enable row level security;

create policy "spenza_wallets_owner" on public.spenza_wallets for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "spenza_transactions_owner" on public.spenza_transactions for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "spenza_bills_owner" on public.spenza_bills for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "spenza_tombstones_owner" on public.spenza_tombstones for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create or replace function public.spenza_server_time()
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$ select now(); $$;

grant execute on function public.spenza_server_time() to authenticated;

create or replace function public.spenza_apply_change(
  p_entity_type text,
  p_entity_id text,
  p_operation text,
  p_changed_at timestamptz,
  p_payload jsonb default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_existing timestamptz;
  v_deleted timestamptz;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_entity_type not in ('wallet','transaction','bill') then raise exception 'Invalid entity type'; end if;
  if p_operation not in ('upsert','delete') then raise exception 'Invalid operation'; end if;
  if p_entity_id is null or p_entity_id = '' then raise exception 'Entity id is required'; end if;

  select deleted_at into v_deleted from public.spenza_tombstones
    where owner_id=v_owner and entity_type=p_entity_type and entity_id=p_entity_id;

  if p_entity_type='wallet' then
    select changed_at into v_existing from public.spenza_wallets where owner_id=v_owner and id=p_entity_id;
  elsif p_entity_type='transaction' then
    select changed_at into v_existing from public.spenza_transactions where owner_id=v_owner and id=p_entity_id;
  else
    select changed_at into v_existing from public.spenza_bills where owner_id=v_owner and id=p_entity_id;
  end if;

  if p_operation='upsert' then
    if p_payload is null then raise exception 'Payload is required for upsert'; end if;
    -- A deletion wins when timestamps tie.
    if v_deleted is not null and v_deleted >= p_changed_at then return false; end if;
    if v_existing is not null and v_existing > p_changed_at then return false; end if;

    if p_entity_type='wallet' then
      insert into public.spenza_wallets(owner_id,id,payload,changed_at) values(v_owner,p_entity_id,p_payload,p_changed_at)
      on conflict(owner_id,id) do update set payload=excluded.payload,changed_at=excluded.changed_at
      where public.spenza_wallets.changed_at <= excluded.changed_at;
    elsif p_entity_type='transaction' then
      insert into public.spenza_transactions(owner_id,id,payload,changed_at) values(v_owner,p_entity_id,p_payload,p_changed_at)
      on conflict(owner_id,id) do update set payload=excluded.payload,changed_at=excluded.changed_at
      where public.spenza_transactions.changed_at <= excluded.changed_at;
    else
      insert into public.spenza_bills(owner_id,id,payload,changed_at) values(v_owner,p_entity_id,p_payload,p_changed_at)
      on conflict(owner_id,id) do update set payload=excluded.payload,changed_at=excluded.changed_at
      where public.spenza_bills.changed_at <= excluded.changed_at;
    end if;
    delete from public.spenza_tombstones where owner_id=v_owner and entity_type=p_entity_type and entity_id=p_entity_id and deleted_at <= p_changed_at;
    return true;
  end if;

  if v_existing is not null and v_existing > p_changed_at then return false; end if;
  if v_deleted is not null and v_deleted > p_changed_at then return false; end if;

  if p_entity_type='wallet' then
    delete from public.spenza_wallets where owner_id=v_owner and id=p_entity_id;
  elsif p_entity_type='transaction' then
    delete from public.spenza_transactions where owner_id=v_owner and id=p_entity_id;
  else
    delete from public.spenza_bills where owner_id=v_owner and id=p_entity_id;
  end if;

  insert into public.spenza_tombstones(owner_id,entity_type,entity_id,deleted_at)
  values(v_owner,p_entity_type,p_entity_id,p_changed_at)
  on conflict(owner_id,entity_type,entity_id) do update set deleted_at=excluded.deleted_at
  where public.spenza_tombstones.deleted_at <= excluded.deleted_at;
  return true;
end;
$$;

grant execute on function public.spenza_apply_change(text,text,text,timestamptz,jsonb) to authenticated;
