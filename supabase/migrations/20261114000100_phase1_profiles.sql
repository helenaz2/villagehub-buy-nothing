-- Phase 1 only. Apply to a LOCAL Supabase database first.
-- No hosted database has been modified by preparing this file.
begin;

create table public.us_states (
  name text primary key
);
insert into public.us_states (name) values
  ('Alabama'),
  ('Alaska'),
  ('Arizona'),
  ('Arkansas'),
  ('California'),
  ('Colorado'),
  ('Connecticut'),
  ('Delaware'),
  ('District of Columbia'),
  ('Florida'),
  ('Georgia'),
  ('Hawaii'),
  ('Idaho'),
  ('Illinois'),
  ('Indiana'),
  ('Iowa'),
  ('Kansas'),
  ('Kentucky'),
  ('Louisiana'),
  ('Maine'),
  ('Maryland'),
  ('Massachusetts'),
  ('Michigan'),
  ('Minnesota'),
  ('Mississippi'),
  ('Missouri'),
  ('Montana'),
  ('Nebraska'),
  ('Nevada'),
  ('New Hampshire'),
  ('New Jersey'),
  ('New Mexico'),
  ('New York'),
  ('North Carolina'),
  ('North Dakota'),
  ('Ohio'),
  ('Oklahoma'),
  ('Oregon'),
  ('Pennsylvania'),
  ('Rhode Island'),
  ('South Carolina'),
  ('South Dakota'),
  ('Tennessee'),
  ('Texas'),
  ('Utah'),
  ('Vermont'),
  ('Virginia'),
  ('Washington'),
  ('West Virginia'),
  ('Wisconsin'),
  ('Wyoming');
alter table public.us_states enable row level security;
revoke all on public.us_states from public, anon, authenticated;
grant select on public.us_states to authenticated;
create policy us_states_read on public.us_states for select to authenticated using (true);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 80),
  username text not null unique check (username ~ '^[a-z0-9_]{3,40}$'),
  bio text not null default '' check (char_length(bio) <= 1000),
  city text not null check (char_length(btrim(city)) between 1 and 100),
  state text not null references public.us_states(name),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'Public general profile data for signed-in neighbors. Never store email, street, auth tokens, or rating aggregates here.';

create table public.account_addresses (
  user_id uuid primary key references auth.users(id) on delete cascade,
  street text check (street is null or char_length(btrim(street)) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.account_addresses is 'Owner-only optional street address. Never join into public profile responses.';

alter table public.profiles enable row level security;
alter table public.account_addresses enable row level security;
revoke all on public.profiles, public.account_addresses from public, anon, authenticated;
grant select, insert on public.profiles to authenticated;
grant update (full_name, username, bio, city, state) on public.profiles to authenticated;
grant select on public.account_addresses to authenticated;
grant insert (user_id, street) on public.account_addresses to authenticated;
grant update (street) on public.account_addresses to authenticated;

create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_create_own on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy addresses_read_own on public.account_addresses for select to authenticated
  using ((select auth.uid()) = user_id);
create policy addresses_create_own on public.account_addresses for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy addresses_update_own on public.account_addresses for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.set_updated_at() from public, anon, authenticated;
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger addresses_updated before update on public.account_addresses
  for each row execute function public.set_updated_at();

-- Identity comes from auth.users, not a user-provided id. Username is generated
-- independently of untrusted metadata. Private street is NOT signup metadata;
-- save it after email confirmation/login via the owner-only addresses table.
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, username, city, state)
  values (
    new.id,
    btrim(new.raw_user_meta_data ->> 'full_name'),
    'member_' || replace(new.id::text, '-', ''),
    btrim(new.raw_user_meta_data ->> 'city'),
    new.raw_user_meta_data ->> 'state'
  );
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
create trigger villagehub_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

commit;
