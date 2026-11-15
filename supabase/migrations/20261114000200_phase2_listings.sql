-- Phase 2: additive schema. Requires a separate hosted review/approval.
begin;
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 2 and 40),
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);
create unique index categories_name_case_unique on public.categories(lower(name));
insert into public.categories(name,sort_order) values ('Furniture',10),('Clothing',20),('Home',30),('Other',2147483647);
alter table public.categories enable row level security;
revoke all on public.categories from public,anon,authenticated;
grant select on public.categories to authenticated;
create policy categories_read on public.categories for select to authenticated using (true);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.categories(id),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description)<=5000),
  condition text not null check (condition in ('Like new','Good condition','Fair','Well loved')),
  condition_note text not null default '' check (char_length(condition_note)<=2000),
  size text not null check (char_length(btrim(size)) between 1 and 200),
  color text not null check (char_length(btrim(color)) between 1 and 100),
  neighborhood text not null check (char_length(btrim(neighborhood)) between 1 and 100),
  city text not null check (char_length(btrim(city)) between 1 and 100),
  tags text[] not null default '{}' check (cardinality(tags)<=20 and char_length(tags::text)<=2000),
  features text[] not null default '{}' check (cardinality(features)<=20 and char_length(features::text)<=2000),
  materials text not null default '' check (char_length(materials)<=500),
  fabric text not null default '' check (char_length(fabric)<=500),
  status text not null default 'draft' check (status in ('draft','available','claimed')),
  search_document tsvector not null default ''::tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index listings_feed on public.listings(status,created_at desc,id desc);
create index listings_owner on public.listings(owner_id,created_at desc);
create index listings_category on public.listings(category_id,status,created_at desc);
create index listings_search on public.listings using gin(search_document);

create table public.listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  object_path text not null unique,
  position integer not null check (position between 0 and 4),
  created_at timestamptz not null default now(),
  unique(listing_id,position)
);
create table public.saved_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,listing_id)
);
create index saved_items_listing on public.saved_items(listing_id);
alter table public.listings enable row level security;
alter table public.listing_photos enable row level security;
alter table public.saved_items enable row level security;
revoke all on public.listings,public.listing_photos,public.saved_items from public,anon,authenticated;
grant select,delete on public.listings to authenticated;
grant insert(owner_id,category_id,title,description,condition,condition_note,size,color,neighborhood,city,tags,features,materials,fabric) on public.listings to authenticated;
grant update(title,description,category_id,condition,condition_note,size,color,neighborhood,city,tags,features,materials,fabric,status) on public.listings to authenticated;
grant select on public.listing_photos to authenticated;
grant select,insert,delete on public.saved_items to authenticated;
create policy listings_read on public.listings for select to authenticated using (status in ('available','claimed') or owner_id=(select auth.uid()));
create policy listings_create_own on public.listings for insert to authenticated with check(owner_id=(select auth.uid()) and status='draft');
create policy listings_edit_own on public.listings for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy listings_delete_own on public.listings for delete to authenticated using(owner_id=(select auth.uid()));
create policy listing_photos_read on public.listing_photos for select to authenticated using(exists(select 1 from public.listings l where l.id=listing_id));
create policy saved_read_own on public.saved_items for select to authenticated using(user_id=(select auth.uid()));
create policy saved_create_own on public.saved_items for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.listings l where l.id=listing_id and l.status in ('available','claimed')));
create policy saved_delete_own on public.saved_items for delete to authenticated using(user_id=(select auth.uid()));

create function public.villagehub_validate_listing()
returns trigger language plpgsql set search_path='' as $$
begin
  new.updated_at:=now();
  new.search_document:=to_tsvector('english',new.title || ' ' || new.description || ' ' || array_to_string(new.tags,' '));
  if new.status <> 'draft' and not exists(select 1 from public.listing_photos p where p.listing_id=new.id) then
    raise exception 'At least one photo is required before publishing' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function public.villagehub_validate_listing() from public,anon,authenticated;
create trigger villagehub_listings_validate before insert or update on public.listings for each row execute function public.villagehub_validate_listing();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('listing-photos','listing-photos',false,10485760,array['image/jpeg','image/png','image/webp','image/heic']);
create policy villagehub_photo_upload on storage.objects for insert to authenticated with check(
  bucket_id='listing-photos' and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists(select 1 from public.listings l where l.owner_id=(select auth.uid()) and l.id::text=(storage.foldername(name))[2])
);
create policy villagehub_photo_read on storage.objects for select to authenticated using(
  bucket_id='listing-photos' and ((storage.foldername(name))[1]=(select auth.uid())::text
    or exists(select 1 from public.listing_photos p join public.listings l on l.id=p.listing_id where p.object_path=name and l.status in ('available','claimed')))
);
create policy villagehub_photo_remove on storage.objects for delete to authenticated using(
  bucket_id='listing-photos' and (storage.foldername(name))[1]=(select auth.uid())::text
  and not exists(select 1 from public.listing_photos p where p.object_path=name)
);

-- Atomic ordered-photo replacement and publication; no direct client photo writes.
create function public.publish_listing_photos(p_listing_id uuid,p_paths text[],p_details jsonb default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_owner uuid; v_path text; v_position integer:=0;
begin
  select owner_id into v_owner from public.listings where id=p_listing_id for update;
  if auth.uid() is null or v_owner is null or v_owner<>auth.uid() then raise exception 'Only the owner may publish photos' using errcode='42501'; end if;
  if p_paths is null or cardinality(p_paths) not between 1 and 5 or array_position(p_paths,null) is not null then raise exception 'Choose 1 to 5 photos' using errcode='23514'; end if;
  if (select count(distinct x) from unnest(p_paths) x)<>cardinality(p_paths) then raise exception 'Duplicate photo' using errcode='23514'; end if;
  foreach v_path in array p_paths loop
    if split_part(v_path,'/',1)<>v_owner::text or split_part(v_path,'/',2)<>p_listing_id::text
      or not exists(select 1 from storage.objects where bucket_id='listing-photos' and name=v_path) then
      raise exception 'Photo must be uploaded to this listing by its owner' using errcode='42501';
    end if;
  end loop;
  delete from public.listing_photos where listing_id=p_listing_id;
  foreach v_path in array p_paths loop
    insert into public.listing_photos(listing_id,object_path,position) values(p_listing_id,v_path,v_position);
    v_position:=v_position+1;
  end loop;
  update public.listings set
    title=coalesce(p_details->>'title',title), description=coalesce(p_details->>'description',description),
    category_id=coalesce((p_details->>'category_id')::uuid,category_id),
    condition=coalesce(p_details->>'condition',condition), condition_note=coalesce(p_details->>'condition_note',condition_note),
    size=coalesce(p_details->>'size',size), color=coalesce(p_details->>'color',color),
    neighborhood=coalesce(p_details->>'neighborhood',neighborhood), city=coalesce(p_details->>'city',city),
    tags=case when p_details ? 'tags' then array(select jsonb_array_elements_text(p_details->'tags')) else tags end,
    features=case when p_details ? 'features' then array(select jsonb_array_elements_text(p_details->'features')) else features end,
    materials=coalesce(p_details->>'materials',materials), fabric=coalesce(p_details->>'fabric',fabric),
    status=case when status='draft' then 'available' else status end
  where id=p_listing_id;
end;
$$;
revoke all on function public.publish_listing_photos(uuid,text[],jsonb) from public,anon,authenticated;
grant execute on function public.publish_listing_photos(uuid,text[],jsonb) to authenticated;
commit;
