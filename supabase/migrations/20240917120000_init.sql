-- Simha: multi-family bar/bat mitzvah planner
create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'family' check (role in ('family','vendor','admin')),
  created_at timestamptz not null default now()
);

create table public.synagogues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rite text not null default 'sepharade' check (rite in ('sepharade','ashkenaze','massorti','autre')),
  address text,
  city text not null,
  postal_code text,
  lat double precision,
  lng double precision,
  contact_name text,
  contact_email text,
  contact_phone text,
  notes text,
  status text not null default 'approved' check (status in ('pending','approved','rejected')),
  suggested_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.halls (
  id uuid primary key default gen_random_uuid(),
  synagogue_id uuid not null references public.synagogues(id) on delete cascade,
  name text not null,
  capacity integer not null default 0,
  usage text not null default 'office' check (usage in ('office','kiddouch','repas','polyvalent')),
  accessible boolean not null default false,
  equipment text,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  child_first_name text not null,
  child_last_name text,
  kind text not null check (kind in ('bar','bat')),
  minhag text not null default 'sepharade' check (minhag in ('sepharade','ashkenaze','autre')),
  birth_date date,
  city text not null,
  lat double precision,
  lng double precision,
  synagogue_id uuid references public.synagogues(id) on delete set null,
  date_tefilin date,
  date_shabbat date,
  date_party date,
  budget_envelope integer,
  guests integer not null default 180,
  g_tef integer not null default 50,
  g_kid integer not null default 120,
  g_dej integer not null default 30,
  kosher text default 'casher' check (kosher in ('casher','casher_glatt','flexible')),
  created_at timestamptz not null default now()
);

create table public.memberships (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  email text not null,
  role text not null default 'editor' check (role in ('owner','editor','viewer')),
  token text not null unique,
  invited_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.app_state (
  event_id uuid not null references public.events(id) on delete cascade,
  key text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (event_id, key)
);

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  name text not null,
  categories text[] not null default '{}',
  city text,
  lat double precision,
  lng double precision,
  radius_km integer not null default 30,
  kasherut text default 'casher' check (kasherut in ('casher','casher_glatt','non_casher','flexible')),
  price_min integer,
  price_max integer,
  description text,
  website text,
  phone text,
  photos text[] not null default '{}',
  moderated boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null unique references public.vendors(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'canceled' check (status in ('active','past_due','canceled','trialing','incomplete')),
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create table public.synagogue_suggestions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete set null,
  name text not null,
  city text not null,
  address text,
  rite text,
  notes text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  suggested_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index guests_event_idx on public.guests (event_id);
create index ai_messages_event_day_idx on public.ai_messages (event_id, created_at);
create index synagogues_city_idx on public.synagogues (city);
create index vendors_city_idx on public.vendors (city);
create index invites_token_idx on public.invites (token);
create index invites_email_idx on public.invites (email);

-- Helpers
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function public.has_event_role(eid uuid, roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.event_id = eid and m.user_id = auth.uid() and m.role = any(roles)
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  intended text;
begin
  intended := coalesce(new.raw_user_meta_data->>'role', 'family');
  if intended not in ('family','vendor','admin') then
    intended := 'family';
  end if;
  if intended = 'admin' then
    intended := 'family';
  end if;
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    new.raw_user_meta_data->>'full_name',
    intended
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.synagogues enable row level security;
alter table public.halls enable row level security;
alter table public.events enable row level security;
alter table public.memberships enable row level security;
alter table public.invites enable row level security;
alter table public.app_state enable row level security;
alter table public.guests enable row level security;
alter table public.vendors enable row level security;
alter table public.subscriptions enable row level security;
alter table public.ai_messages enable row level security;
alter table public.synagogue_suggestions enable row level security;

create policy profiles_select on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

create policy synagogues_select on public.synagogues for select using (status = 'approved' or public.is_admin() or suggested_by = auth.uid());
create policy synagogues_admin on public.synagogues for all using (public.is_admin()) with check (public.is_admin());

create policy halls_select on public.halls for select using (
  exists (select 1 from public.synagogues s where s.id = synagogue_id and (s.status = 'approved' or public.is_admin()))
);
create policy halls_admin on public.halls for all using (public.is_admin()) with check (public.is_admin());

create policy events_select on public.events for select using (public.has_event_role(id, array['owner','editor','viewer']) or public.is_admin());
create policy events_insert on public.events for insert with check (created_by = auth.uid());
create policy events_update on public.events for update using (public.has_event_role(id, array['owner','editor']) or public.is_admin());
create policy events_delete on public.events for delete using (public.has_event_role(id, array['owner']) or public.is_admin());

create policy memberships_select on public.memberships for select using (public.has_event_role(event_id, array['owner','editor','viewer']) or user_id = auth.uid() or public.is_admin());
create policy memberships_insert on public.memberships for insert with check (user_id = auth.uid() or public.has_event_role(event_id, array['owner']) or public.is_admin());
create policy memberships_delete on public.memberships for delete using (public.has_event_role(event_id, array['owner']) or public.is_admin());

create policy invites_select on public.invites for select using (public.has_event_role(event_id, array['owner','editor']) or public.is_admin() or lower(email) = lower(coalesce((select email from public.profiles where id = auth.uid()), '')));
create policy invites_insert on public.invites for insert with check (public.has_event_role(event_id, array['owner','editor']) or public.is_admin());
create policy invites_update on public.invites for update using (public.has_event_role(event_id, array['owner']) or public.is_admin() or lower(email) = lower(coalesce((select email from public.profiles where id = auth.uid()), '')));
create policy invites_delete on public.invites for delete using (public.has_event_role(event_id, array['owner']) or public.is_admin());

create policy app_state_all on public.app_state for all using (
  public.has_event_role(event_id, array['owner','editor','viewer']) or public.is_admin()
) with check (
  public.has_event_role(event_id, array['owner','editor']) or public.is_admin()
);

create policy guests_select on public.guests for select using (public.has_event_role(event_id, array['owner','editor','viewer']) or public.is_admin());
create policy guests_write on public.guests for insert with check (public.has_event_role(event_id, array['owner','editor']) or public.is_admin());
create policy guests_update on public.guests for update using (public.has_event_role(event_id, array['owner','editor']) or public.is_admin());
create policy guests_delete on public.guests for delete using (public.has_event_role(event_id, array['owner','editor']) or public.is_admin());

create or replace function public.vendor_is_listed(vid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.vendors v
    join public.subscriptions s on s.vendor_id = v.id
    where v.id = vid and v.moderated = true and s.status in ('active','trialing')
  );
$$;

create policy vendors_select on public.vendors for select using (
  user_id = auth.uid() or public.is_admin() or public.vendor_is_listed(id)
);
create policy vendors_insert on public.vendors for insert with check (user_id = auth.uid());
create policy vendors_update on public.vendors for update using (user_id = auth.uid() or public.is_admin());

create policy subscriptions_select on public.subscriptions for select using (
  public.is_admin() or exists (select 1 from public.vendors v where v.id = vendor_id and v.user_id = auth.uid())
  or status in ('active','trialing')
);
create policy subscriptions_admin on public.subscriptions for all using (public.is_admin()) with check (public.is_admin());

create policy ai_select on public.ai_messages for select using (public.has_event_role(event_id, array['owner','editor','viewer']) or public.is_admin());
create policy ai_insert on public.ai_messages for insert with check (public.has_event_role(event_id, array['owner','editor']) or public.is_admin());

create policy suggestions_select on public.synagogue_suggestions for select using (suggested_by = auth.uid() or public.is_admin());
create policy suggestions_insert on public.synagogue_suggestions for insert with check (suggested_by = auth.uid());
create policy suggestions_admin on public.synagogue_suggestions for update using (public.is_admin());

-- Ownership: after event insert, add owner membership
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

drop trigger if exists on_event_created on public.events;
create trigger on_event_created
  after insert on public.events
  for each row execute function public.handle_new_event();

alter publication supabase_realtime add table public.app_state;
alter publication supabase_realtime add table public.guests;
alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.memberships;
