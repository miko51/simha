create or replace function public.handle_new_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.memberships (event_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

create or replace function public.create_family_event(payload jsonb)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ev public.events;
begin
  if uid is null then
    raise exception 'Non authentifié';
  end if;
  insert into public.profiles (id, email, role)
  values (uid, coalesce(payload->>'email', ''), 'family')
  on conflict (id) do nothing;

  insert into public.events (
    created_by, child_first_name, child_last_name, kind, minhag, birth_date,
    city, lat, lng, synagogue_id, date_tefilin, date_shabbat, date_party,
    budget_envelope, guests, g_tef, g_kid, g_dej, kosher
  ) values (
    uid,
    nullif(trim(coalesce(payload->>'child_first_name','')), ''),
    nullif(trim(coalesce(payload->>'child_last_name','')), ''),
    case when payload->>'kind' = 'bat' then 'bat' else 'bar' end,
    case when coalesce(payload->>'minhag','') in ('sepharade','ashkenaze','autre') then payload->>'minhag' else 'sepharade' end,
    nullif(payload->>'birth_date','')::date,
    coalesce(nullif(trim(coalesce(payload->>'city','')), ''), 'Paris'),
    nullif(payload->>'lat','')::double precision,
    nullif(payload->>'lng','')::double precision,
    nullif(payload->>'synagogue_id','')::uuid,
    nullif(payload->>'date_tefilin','')::date,
    nullif(payload->>'date_shabbat','')::date,
    nullif(payload->>'date_party','')::date,
    nullif(payload->>'budget_envelope','')::integer,
    coalesce(nullif(payload->>'guests','')::integer, 180),
    coalesce(nullif(payload->>'g_tef','')::integer, 50),
    coalesce(nullif(payload->>'g_kid','')::integer, 120),
    coalesce(nullif(payload->>'g_dej','')::integer, 30),
    case when coalesce(payload->>'kosher','') in ('casher','casher_glatt','flexible') then payload->>'kosher' else 'casher' end
  ) returning * into ev;
  return ev;
end;
$$;

revoke all on function public.create_family_event(jsonb) from public;
grant execute on function public.create_family_event(jsonb) to authenticated;

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert with check (id = auth.uid());
