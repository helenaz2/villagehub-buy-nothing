-- Curbside schema.
--
-- Privacy rule that shapes everything here: an exact address or coordinate
-- never sits in a table that other users can read. `listings` only carries a
-- blurred point. The real address lives in `listing_private`, which row-level
-- security opens to the owner and to a claimant the owner has confirmed.

create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- profiles

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default 'Neighbor',
  neighborhood text,
  verified text check (verified in ('phone', 'edu')),
  rating numeric(2, 1) not null default 5.0,
  handoffs integer not null default 0,
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, verified)
  values (
    new.id,
    case
      when new.email like '%.edu' and new.email_confirmed_at is not null then 'edu'
      when new.phone_confirmed_at is not null then 'phone'
    end
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- listings

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  category text not null check (category in
    ('seating', 'tables', 'storage', 'beds', 'lighting', 'appliances', 'electronics', 'decor', 'bikes', 'other')),
  subcategory text not null,
  color text not null,
  material text not null,
  condition text not null check (condition in ('like_new', 'good', 'worn', 'damaged')),
  dims jsonb not null,
  brand text,
  description text not null,
  tags text[] not null default '{}',
  pickup text not null check (pickup in ('one_person', 'two_people', 'needs_truck', 'needs_disassembly')),
  weight_class text not null check (weight_class in ('light', 'medium', 'heavy', 'very_heavy')),
  price_usd integer not null default 0 check (price_usd >= 0),
  est_value_usd integer not null default 0,
  neighborhood text not null,
  -- Blurred to a grid of roughly 300 m. Safe to show on a map.
  approx extensions.geography(Point, 4326) not null,
  mode text not null default 'first_come' check (mode in ('first_come', 'owner_picks')),
  status text not null default 'available' check (status in ('available', 'pending', 'given')),
  available_today boolean not null default false,
  -- The raw model output and its per-field confidence, kept for auditing and prompt tuning.
  ai_payload jsonb,
  confidence jsonb,
  created_at timestamptz not null default now()
);

create index listings_approx_idx on public.listings using gist (approx);
create index listings_status_created_idx on public.listings (status, created_at desc);

create table public.listing_private (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  address text not null,
  exact extensions.geography(Point, 4326) not null
);

-- Whatever the client sent as `approx`, replace it with a server-side blur of the real point.
create function public.blur_listing_location() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.listings
  set approx = st_snaptogrid(new.exact::geometry, 0.003)::geography
  where id = new.listing_id;
  return new;
end $$;

create trigger listing_private_blur after insert or update on public.listing_private
  for each row execute function public.blur_listing_location();

create table public.listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  url text not null,
  position integer not null default 0,
  -- Set by the moderation step before a photo is shown to anyone but its owner.
  moderated boolean not null default false
);

-- ---------------------------------------------------------------- claims and chat

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  note text not null default '',
  status text not null default 'waiting' check (status in ('waiting', 'confirmed', 'passed')),
  created_at timestamptz not null default now(),
  unique (listing_id, user_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  pickup_at timestamptz,
  porch boolean not null default false,
  meet_spot text,
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  -- null means a system message
  sender_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);

create table public.handoffs (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'done')),
  -- Stripe PaymentIntent held with capture_method = manual, captured on handoff.
  payment_intent_id text,
  completed_at timestamptz
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  handoff_id uuid not null references public.handoffs (id) on delete cascade,
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  stars integer not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  unique (handoff_id, from_id)
);

create table public.wanted_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 4 and 280),
  category text not null,
  near extensions.geography(Point, 4326),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- disposal, impact, reports

create table public.disposal_locations (
  id text primary key,
  name text not null,
  kind text not null,
  -- 1 goes into a home, 2 free pickup, 3 reuse and recycling, 4 city service, 5 paid removal
  tier integer not null check (tier between 1 and 5),
  location extensions.geography(Point, 4326) not null,
  address text not null,
  phone text,
  url text,
  hours jsonb,
  accepts text[] not null default '{}',
  min_condition text not null default 'good',
  refuses text[] not null default '{}',
  takes_flags text[] not null default '{}',
  pickup text not null check (pickup in ('free', 'paid', 'request', 'none')),
  pickup_note text,
  dropoff boolean not null default true,
  tax_receipt boolean not null default false,
  why text not null,
  note text,
  cost_note text,
  source text not null,
  checked text not null
);

create index disposal_locations_idx on public.disposal_locations using gist (location);

create table public.impact_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  kind text not null check (kind in ('rehomed', 'donated', 'recycled')),
  title text not null,
  lbs integer not null,
  co2_kg integer not null,
  saved_usd integer not null,
  near extensions.geography(Point, 4326),
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete cascade,
  reported_user_id uuid references public.profiles (id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  primary key (blocker_id, blocked_id)
);

create table public.scan_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  model text not null,
  prompt_version text not null,
  latency_ms integer not null,
  attempts integer not null,
  ok boolean not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- row-level security

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.listing_private enable row level security;
alter table public.listing_photos enable row level security;
alter table public.claims enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.handoffs enable row level security;
alter table public.reviews enable row level security;
alter table public.wanted_posts enable row level security;
alter table public.disposal_locations enable row level security;
alter table public.impact_events enable row level security;
alter table public.reports enable row level security;
alter table public.blocks enable row level security;
alter table public.scan_logs enable row level security;

create policy "profiles are readable by signed-in users" on public.profiles
  for select to authenticated using (true);
create policy "users edit their own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "listings are readable by signed-in users" on public.listings
  for select to authenticated using (
    not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = owner_id)
         or (b.blocker_id = owner_id and b.blocked_id = auth.uid())
    )
  );
create policy "owners create listings" on public.listings
  for insert to authenticated with check (owner_id = auth.uid());
create policy "owners edit listings" on public.listings
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owners delete listings" on public.listings
  for delete to authenticated using (owner_id = auth.uid());

-- The address: owner always, claimant only after the owner confirms them.
create policy "address visible to owner and confirmed claimant" on public.listing_private
  for select to authenticated using (
    exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
    or exists (
      select 1 from public.claims c
      where c.listing_id = listing_private.listing_id and c.user_id = auth.uid() and c.status = 'confirmed'
    )
  );
create policy "owners set the address" on public.listing_private
  for insert to authenticated with check (
    exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
  );

create policy "photos are readable" on public.listing_photos
  for select to authenticated using (true);
create policy "owners add photos" on public.listing_photos
  for insert to authenticated with check (
    exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
  );

create policy "claims visible to claimant and owner" on public.claims
  for select to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
  );
create policy "people claim listings that are not theirs" on public.claims
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.status = 'available' and l.owner_id <> auth.uid()
    )
  );
create policy "claimants withdraw" on public.claims
  for delete to authenticated using (user_id = auth.uid() and status = 'waiting');

create policy "conversations visible to both sides" on public.conversations
  for select to authenticated using (auth.uid() in (buyer_id, seller_id));
create policy "both sides set pickup details" on public.conversations
  for update to authenticated using (auth.uid() in (buyer_id, seller_id))
  with check (auth.uid() in (buyer_id, seller_id));

create policy "messages visible to both sides" on public.messages
  for select to authenticated using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)
    )
  );
create policy "both sides send messages" on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)
    )
  );

-- Only the seller can read the handoff token. The buyer proves presence by scanning it.
create policy "seller reads the handoff code" on public.handoffs
  for select to authenticated using (
    exists (select 1 from public.conversations c where c.id = conversation_id and c.seller_id = auth.uid())
  );

create policy "reviews are readable" on public.reviews
  for select to authenticated using (true);
create policy "participants leave reviews" on public.reviews
  for insert to authenticated with check (
    from_id = auth.uid()
    and exists (
      select 1 from public.handoffs h
      join public.conversations c on c.id = h.conversation_id
      where h.id = handoff_id and h.status = 'done'
        and auth.uid() in (c.buyer_id, c.seller_id) and to_id in (c.buyer_id, c.seller_id)
    )
  );

create policy "wanted posts are readable" on public.wanted_posts
  for select to authenticated using (true);
create policy "people post their own requests" on public.wanted_posts
  for insert to authenticated with check (user_id = auth.uid());
create policy "people remove their own requests" on public.wanted_posts
  for delete to authenticated using (user_id = auth.uid());

create policy "disposal locations are public" on public.disposal_locations
  for select to anon, authenticated using (true);

create policy "impact is readable" on public.impact_events
  for select to authenticated using (true);
create policy "people log their own donations" on public.impact_events
  for insert to authenticated with check (user_id = auth.uid() and kind in ('donated', 'recycled'));

create policy "people file reports" on public.reports
  for insert to authenticated with check (reporter_id = auth.uid());

create policy "people manage their own blocks" on public.blocks
  for all to authenticated using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

-- scan_logs has no policies: only the service role (the edge function) writes to it.

-- ---------------------------------------------------------------- functions

create function public.nearby_listings(lat double precision, lng double precision, radius_m integer default 8000)
returns table (
  id uuid, owner_id uuid, title text, category text, subcategory text, color text, material text,
  condition text, dims jsonb, brand text, description text, tags text[], pickup text, weight_class text,
  price_usd integer, est_value_usd integer, neighborhood text, approx_lat double precision,
  approx_lng double precision, mode text, status text, available_today boolean, created_at timestamptz,
  photos text[], distance_m double precision
)
language sql stable set search_path = public, extensions as $$
  select
    l.id, l.owner_id, l.title, l.category, l.subcategory, l.color, l.material, l.condition, l.dims,
    l.brand, l.description, l.tags, l.pickup, l.weight_class, l.price_usd, l.est_value_usd,
    l.neighborhood, st_y(l.approx::geometry), st_x(l.approx::geometry), l.mode, l.status,
    l.available_today, l.created_at,
    array(select p.url from public.listing_photos p where p.listing_id = l.id order by p.position),
    st_distance(l.approx, st_setsrid(st_makepoint(lng, lat), 4326)::geography)
  from public.listings l
  where l.status <> 'given'
    and st_dwithin(l.approx, st_setsrid(st_makepoint(lng, lat), 4326)::geography, radius_m)
  -- Twelve hours of age counts like one mile, the same rule the app uses offline.
  order by st_distance(l.approx, st_setsrid(st_makepoint(lng, lat), 4326)::geography) / 1609.0
         + extract(epoch from (now() - l.created_at)) / 3600.0 / 12.0
  limit 200;
$$;

-- The public view of a claim queue: order and first names, never the private notes.
create function public.claim_queue(p_listing_id uuid)
returns table (place bigint, first_name text, status text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by c.created_at), split_part(p.name, ' ', 1), c.status, c.created_at
  from public.claims c join public.profiles p on p.id = c.user_id
  where c.listing_id = p_listing_id and c.status <> 'passed'
  order by c.created_at;
$$;

create function public._confirm_claim(p_claim_id uuid) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_claim public.claims;
  v_listing public.listings;
  v_address text;
  v_seller text;
  v_conversation uuid;
begin
  select * into v_claim from public.claims where id = p_claim_id for update;
  if not found then raise exception 'claim not found'; end if;
  select * into v_listing from public.listings where id = v_claim.listing_id for update;
  if v_listing.status <> 'available' then raise exception 'listing is no longer available'; end if;

  update public.claims
    set status = case when id = p_claim_id then 'confirmed' else 'passed' end
    where listing_id = v_listing.id;
  update public.listings set status = 'pending' where id = v_listing.id;

  insert into public.conversations (listing_id, buyer_id, seller_id)
    values (v_listing.id, v_claim.user_id, v_listing.owner_id)
    returning id into v_conversation;

  insert into public.handoffs (listing_id, conversation_id, token)
    values (v_listing.id, v_conversation,
            'CURB-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 4))
              || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 4)));

  select address into v_address from public.listing_private where listing_id = v_listing.id;
  select split_part(name, ' ', 1) into v_seller from public.profiles where id = v_listing.owner_id;
  insert into public.messages (conversation_id, sender_id, body)
    values (v_conversation, null,
            coalesce(v_seller, 'The owner') || ' confirmed the claim. Pickup address: '
              || coalesce(v_address, 'ask in chat') || '.');

  return v_conversation;
end $$;

revoke all on function public._confirm_claim(uuid) from public, anon, authenticated;

-- Called by the owner in "I pick" mode.
create function public.confirm_claim(p_claim_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.claims c join public.listings l on l.id = c.listing_id
    where c.id = p_claim_id and l.owner_id = auth.uid()
  ) then
    raise exception 'only the owner can confirm a claim';
  end if;
  return public._confirm_claim(p_claim_id);
end $$;

-- First come, first served: the first claim confirms itself.
create function public.auto_confirm_first_claim() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.listings l
    where l.id = new.listing_id and l.mode = 'first_come' and l.status = 'available'
  ) then
    perform public._confirm_claim(new.id);
  end if;
  return new;
end $$;

create trigger claims_auto_confirm after insert on public.claims
  for each row execute function public.auto_confirm_first_claim();

-- The buyer scans the seller's code. One call closes the listing, records the
-- impact, and is the point where a held payment gets captured.
create function public.complete_handoff(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_handoff public.handoffs;
  v_conv public.conversations;
  v_listing public.listings;
  v_lbs integer;
  v_factor numeric;
begin
  select * into v_handoff from public.handoffs where token = upper(trim(p_token)) for update;
  if not found then raise exception 'unknown pickup code'; end if;
  select * into v_conv from public.conversations where id = v_handoff.conversation_id;
  if v_conv.buyer_id <> auth.uid() then raise exception 'only the person picking up can scan this code'; end if;
  if v_handoff.status = 'done' then return v_handoff.id; end if;
  select * into v_listing from public.listings where id = v_handoff.listing_id;

  update public.handoffs set status = 'done', completed_at = now() where id = v_handoff.id;
  update public.listings set status = 'given' where id = v_listing.id;
  update public.profiles set handoffs = handoffs + 1 where id in (v_conv.buyer_id, v_conv.seller_id);

  -- Same estimate as src/lib/impact.ts. Keep the two in step.
  v_lbs := case v_listing.weight_class when 'light' then 12 when 'medium' then 35 when 'heavy' then 75 else 130 end;
  v_factor := case v_listing.category
    when 'seating' then 2.4 when 'tables' then 1.2 when 'storage' then 1.2 when 'beds' then 2.6
    when 'lighting' then 3.0 when 'appliances' then 5.5 when 'electronics' then 8.0
    when 'bikes' then 4.0 else 1.5 end;
  insert into public.impact_events (user_id, listing_id, kind, title, lbs, co2_kg, saved_usd, near)
    values (v_listing.owner_id, v_listing.id, 'rehomed', v_listing.title, v_lbs,
            round(v_lbs * 0.4536 * v_factor * 0.5),
            greatest(0, v_listing.est_value_usd - v_listing.price_usd), v_listing.approx);

  insert into public.messages (conversation_id, sender_id, body)
    values (v_conv.id, null, 'Handoff confirmed. One more thing kept out of the landfill.');
  return v_handoff.id;
end $$;

-- Pounds diverted near a point this month, for the counter on the home feed.
create function public.neighborhood_lbs(lat double precision, lng double precision, radius_m integer default 3000)
returns integer language sql stable security definer set search_path = public, extensions as $$
  select coalesce(sum(lbs), 0)::integer from public.impact_events
  where created_at >= date_trunc('month', now())
    and near is not null
    and st_dwithin(near, st_setsrid(st_makepoint(lng, lat), 4326)::geography, radius_m);
$$;

grant execute on function public.nearby_listings(double precision, double precision, integer) to authenticated;
grant execute on function public.claim_queue(uuid) to authenticated;
grant execute on function public.confirm_claim(uuid) to authenticated;
grant execute on function public.complete_handoff(text) to authenticated;
grant execute on function public.neighborhood_lbs(double precision, double precision, integer) to anon, authenticated;

-- ---------------------------------------------------------------- realtime and storage

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.claims;

insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

create policy "listing photos are public" on storage.objects
  for select using (bucket_id = 'listing-photos');
create policy "signed-in users upload listing photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'listing-photos');
