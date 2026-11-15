-- Phase A foundation and private URL intake. No publication or collection jobs.
begin;
create table public.external_system_identity (
 slot text primary key check(slot='villagehub-buy-nothing'),
 user_id uuid unique,
 created_at timestamptz not null default now()
);
insert into public.external_system_identity(slot) values('villagehub-buy-nothing');
comment on column public.external_system_identity.user_id is 'Service-only one-time expected Auth UUID, registered before Auth creates its profile. No public login/session is used.';
create table public.external_reviewers (
 user_id uuid primary key references public.profiles(id),
 role text not null check(role in ('reviewer','administrator')),
 created_at timestamptz not null default now()
);
create function public.external_system_user_id() returns uuid language sql stable security definer set search_path='' as $$ select user_id from public.external_system_identity where slot='villagehub-buy-nothing'; $$;
create function public.is_external_reviewer() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.external_reviewers where user_id=auth.uid()); $$;
revoke all on function public.external_system_user_id(),public.is_external_reviewer() from public,anon,authenticated;
grant execute on function public.external_system_user_id(),public.is_external_reviewer() to authenticated,service_role;

do $$ begin
 if exists(select 1 from public.profiles where regexp_replace(lower(username),'[^a-z0-9]','','g') in ('villagehubbuynothing','villagehubofficial','villagehubadmin') or regexp_replace(lower(full_name),'[^a-z0-9]','','g') in ('villagehubbuynothing','villagehubofficial','villagehubadmin')) then
  raise exception 'An existing profile conflicts with the reserved identity; review it before applying this migration';
 end if;
end $$;
alter table public.profiles drop constraint profiles_username_check;
alter table public.profiles add constraint profiles_username_check check(username ~ '^[a-z0-9_]{3,40}$' or username='villagehub-buy-nothing');
create function public.guard_external_system_identity() returns trigger language plpgsql security definer set search_path='' as $$
declare v_system uuid:=public.external_system_user_id();
begin
 if new.id is not distinct from v_system and auth.role()='authenticated' then raise exception 'System profiles are managed only by trusted services' using errcode='42501'; end if;
 if (regexp_replace(lower(new.username),'[^a-z0-9]','','g') in ('villagehubbuynothing','villagehubofficial','villagehubadmin') or regexp_replace(lower(new.full_name),'[^a-z0-9]','','g') in ('villagehubbuynothing','villagehubofficial','villagehubadmin')) and new.id is distinct from v_system then
  raise exception 'This system identity is reserved' using errcode='42501';
 end if;
 if new.username='villagehub-buy-nothing' and new.full_name<>'VillageHub Buy Nothing' then raise exception 'Invalid system display name' using errcode='23514'; end if;
 return new;
end;
$$;
revoke all on function public.guard_external_system_identity() from public,anon,authenticated;
create trigger protect_external_system_profile before insert or update on public.profiles for each row execute function public.guard_external_system_identity();
create function public.guard_external_system_listing() returns trigger language plpgsql security definer set search_path='' as $$
declare v_owner uuid;
begin
 v_owner:=case when tg_op='DELETE' then old.owner_id else new.owner_id end;
 if auth.role()='authenticated' and v_owner=public.external_system_user_id() then raise exception 'Only trusted backend services can manage system posts' using errcode='42501'; end if;
 if tg_op='DELETE' then return old; end if;return new;
end;
$$;
revoke all on function public.guard_external_system_listing() from public,anon,authenticated;
create trigger protect_external_system_posts before insert or update or delete on public.listings for each row execute function public.guard_external_system_listing();
create function public.register_external_system_identity(p_user_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if p_user_id is null then raise exception 'Identity UUID required' using errcode='23514'; end if;
 select user_id into v_id from public.external_system_identity where slot='villagehub-buy-nothing' for update;
 if v_id is not null and v_id<>p_user_id then raise exception 'System identity is already designated' using errcode='23514'; end if;
 update public.external_system_identity set user_id=p_user_id where slot='villagehub-buy-nothing';return p_user_id;
end;
$$;
revoke all on function public.register_external_system_identity(uuid) from public,anon,authenticated;
grant execute on function public.register_external_system_identity(uuid) to service_role;

create table public.external_sources (
 id uuid primary key default gen_random_uuid(),slug text not null unique,name text not null,
 submission_enabled boolean not null default false,
 collection_authorized boolean not null default false,republication_authorized boolean not null default false,
 availability_verification_supported boolean not null default false,
 authorization_evidence text,authorization_reviewed_at timestamptz,
 terms_url text not null,allowed_hosts text[] not null,
 coverage_cities text[] not null default array['Berkeley','Oakland','San Francisco','Alameda','Albany','Emeryville','Richmond','El Cerrito','San Leandro','Daly City','South San Francisco','San Pablo','Piedmont'],
 interval_hours integer not null default 12 check(interval_hours between 6 and 168),
 automatic_publication boolean not null default false check(not automatic_publication or (collection_authorized and republication_authorized and availability_verification_supported)),
 status text not null default 'unavailable' check(status in ('unavailable','link_only','authorized','paused')),
 last_error text,last_success_at timestamptz,
 check(not collection_authorized or nullif(btrim(authorization_evidence),'') is not null),
 check(not republication_authorized or nullif(btrim(authorization_evidence),'') is not null)
);
insert into public.external_sources(slug,name,submission_enabled,terms_url,allowed_hosts,status) values
 ('facebook_marketplace','Facebook Marketplace',true,'https://www.facebook.com/legal/automated_data_collection_terms',array['www.facebook.com'],'link_only'),
 ('craigslist','Craigslist',true,'https://www.craigslist.org/about/terms.of.use/en',array['sfbay.craigslist.org'],'link_only'),
 ('freecycle','Freecycle',true,'https://www.freecycle.org/pages/TOS',array['www.freecycle.org'],'link_only'),
 ('buy_nothing','Buy Nothing communities',false,'https://buynothingproject.org/terms',array['buynothingproject.org'],'unavailable');
create table public.external_discovery_runs (
 id uuid primary key default gen_random_uuid(),source_id uuid not null references public.external_sources(id),
 mode text not null check(mode in ('user_url','authorized_feed')),
 status text not null check(status in ('queued','running','completed','failed','unavailable')),
 attempt integer not null default 0 check(attempt between 0 and 3),
 lease_token uuid,lease_until timestamptz,started_at timestamptz not null default now(),finished_at timestamptz,
 items_seen integer not null default 0,items_queued integer not null default 0,error_code text,summary text
);
create unique index external_one_active_run on public.external_discovery_runs(source_id) where status='running' and mode='authorized_feed';
create table public.external_listing_candidates (
 id uuid primary key default gen_random_uuid(),source_id uuid not null references public.external_sources(id),
 external_id text not null,canonical_url text not null unique check(char_length(canonical_url)<=2048 and canonical_url like 'https://%'),
 first_discovered_at timestamptz not null default now(),last_seen_at timestamptz not null default now(),last_verified_at timestamptz,
 availability text not null default 'unverified' check(availability in ('unverified','verified_available','unavailable','expired','stale')),
 review_status text not null default 'pending' check(review_status in ('pending','approved','rejected','needs_permission')),
 rights_status text not null default 'unverified' check(rights_status in ('unverified','authorized','denied')),
 free_status text not null default 'unverified' check(free_status in ('unverified','confirmed_free','rejected')),
 publication_status text not null default 'not_published' check(publication_status in ('not_published','published','withdrawn')),
 ai_result jsonb,ai_confidence numeric check(ai_confidence between 0 and 1),warnings text[] not null default '{}',
 unique(source_id,external_id)
);
create table public.external_link_submissions (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id),
 candidate_id uuid not null references public.external_listing_candidates(id),source_id uuid not null references public.external_sources(id),
 original_url text not null,original_title text not null check(char_length(original_title) between 1 and 120),
 original_notes text not null check(char_length(original_notes) between 1 and 1000),
 reported_price numeric check(reported_price is null or reported_price>=0),
 offer_kind text not null check(offer_kind in ('offer','wanted','rental','service')),
 reported_availability text not null check(reported_availability in ('unverified','unavailable','expired')),
 city text,neighborhood text,notes_owned boolean not null check(notes_owned),
 free_classification text not null check(free_classification in ('reported_free','rejected','needs_review')),
 warnings text[] not null,created_at timestamptz not null default now(),
 unique(user_id,candidate_id)
);
create index external_submissions_owner on public.external_link_submissions(user_id,created_at desc);
create table public.external_listing_reviews (
 id uuid primary key default gen_random_uuid(),candidate_id uuid not null references public.external_listing_candidates(id),
 reviewer_id uuid not null references public.profiles(id),decision text not null check(decision in ('approve','reject','edit','needs_permission')),
 permission_evidence text,free_evidence text,edited_details jsonb,notes text,created_at timestamptz not null default now()
);
create table public.external_listing_links (
 candidate_id uuid primary key references public.external_listing_candidates(id),
 listing_id uuid unique references public.listings(id) on delete set null,
 source_name text not null,source_url text not null check(source_url like 'https://%'),
 availability text not null default 'unverified' check(availability in ('unverified','verified_available','unavailable','expired','stale')),
 last_verified_at timestamptz,fresh_until timestamptz,verification_method text,
 publication_status text not null default 'not_published' check(publication_status in ('not_published','published','withdrawn'))
);
alter table public.external_system_identity enable row level security;
alter table public.external_reviewers enable row level security;
alter table public.external_sources enable row level security;
alter table public.external_discovery_runs enable row level security;
alter table public.external_listing_candidates enable row level security;
alter table public.external_link_submissions enable row level security;
alter table public.external_listing_reviews enable row level security;
alter table public.external_listing_links enable row level security;
revoke all on public.external_system_identity,public.external_reviewers,public.external_sources,public.external_discovery_runs,public.external_listing_candidates,public.external_link_submissions,public.external_listing_reviews,public.external_listing_links from public,anon,authenticated;
grant all on public.external_system_identity,public.external_reviewers,public.external_sources,public.external_discovery_runs,public.external_listing_candidates,public.external_link_submissions,public.external_listing_reviews,public.external_listing_links to service_role;
grant select on public.external_system_identity,public.external_reviewers,public.external_discovery_runs,public.external_listing_candidates,public.external_link_submissions,public.external_listing_reviews,public.external_listing_links to authenticated;
grant select(id,slug,name,submission_enabled,terms_url,coverage_cities,status) on public.external_sources to authenticated;
create policy external_identity_read on public.external_system_identity for select to authenticated using(true);
create policy external_reviewer_own on public.external_reviewers for select to authenticated using(user_id=auth.uid());
create policy external_sources_read on public.external_sources for select to authenticated using(true);
create policy external_runs_review on public.external_discovery_runs for select to authenticated using(public.is_external_reviewer());
create policy external_candidates_review on public.external_listing_candidates for select to authenticated using(public.is_external_reviewer());
create policy external_submissions_read on public.external_link_submissions for select to authenticated using(user_id=auth.uid() or public.is_external_reviewer());
create policy external_reviews_read on public.external_listing_reviews for select to authenticated using(public.is_external_reviewer());
create policy external_links_read on public.external_listing_links for select to authenticated using(public.is_external_reviewer() or (publication_status='published' and exists(select 1 from public.listings l where l.id=listing_id)));

-- Fail closed before the publishing phase exists. This also makes expiry a
-- read-time gate; visibility cannot depend solely on a future Cron job running.
create function public.external_publication_visible(p_listing_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.external_listing_links link
 join public.external_listing_candidates c on c.id=link.candidate_id
 join public.external_sources s on s.id=c.source_id
 where link.listing_id=p_listing_id and link.publication_status='published'
 and link.availability='verified_available' and link.last_verified_at is not null and link.fresh_until>now() and link.last_verified_at+interval '12 hours'>now()
 and c.review_status='approved' and c.rights_status='authorized' and c.free_status='confirmed_free' and c.availability='verified_available' and s.republication_authorized and s.availability_verification_supported and s.status='authorized'
 and exists(select 1 from public.external_listing_reviews review where review.candidate_id=c.id and review.decision='approve' and nullif(btrim(review.permission_evidence),'') is not null and nullif(btrim(review.free_evidence),'') is not null));
$$;
revoke all on function public.external_publication_visible(uuid) from public,anon,authenticated;
grant execute on function public.external_publication_visible(uuid) to authenticated,service_role;
create policy external_system_listing_visibility on public.listings as restrictive for select to authenticated
 using(owner_id is distinct from public.external_system_user_id() or public.external_publication_visible(id));
create function public.guard_external_publication() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.publication_status='published' then
  if new.availability<>'verified_available' or new.last_verified_at is null or new.last_verified_at>now() or new.fresh_until is null or new.fresh_until<=now() or new.fresh_until>new.last_verified_at+interval '12 hours' or nullif(btrim(new.verification_method),'') is null then raise exception 'Current availability verification required (at most 12 hours)' using errcode='23514'; end if;
  if not exists(select 1 from public.external_listing_candidates c join public.external_sources s on s.id=c.source_id where c.id=new.candidate_id and c.review_status='approved' and c.rights_status='authorized' and c.free_status='confirmed_free' and c.availability='verified_available' and s.republication_authorized and s.availability_verification_supported and s.status='authorized' and new.source_url=c.canonical_url and new.source_name=s.name) then raise exception 'Confirmed free offer, review, source attribution and republication authorization required' using errcode='42501'; end if;
  if not exists(select 1 from public.external_listing_reviews review where review.candidate_id=new.candidate_id and review.decision='approve' and nullif(btrim(review.permission_evidence),'') is not null and nullif(btrim(review.free_evidence),'') is not null) then raise exception 'Recorded free-offer and permission evidence required' using errcode='42501'; end if;
  if not exists(select 1 from public.listings l where l.id=new.listing_id and l.owner_id=public.external_system_user_id() and l.status='available') then raise exception 'System-owned published listing required' using errcode='23514'; end if;
 end if;
 return new;
end;
$$;
revoke all on function public.guard_external_publication() from public,anon,authenticated;
create trigger protect_external_publication before insert or update on public.external_listing_links for each row execute function public.guard_external_publication();
create function public.guard_external_host_messaging() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.host_id=public.external_system_user_id() then raise exception 'Use the original source to contact the seller; VillageHub is not the item owner' using errcode='42501'; end if;
 return new;
end;
$$;
revoke all on function public.guard_external_host_messaging() from public,anon,authenticated;
create trigger prevent_external_host_conversation before insert on public.conversations for each row execute function public.guard_external_host_messaging();

create function public.receive_external_link(p_user_id uuid,p_source_slug text,p_external_id text,p_url text,p_evidence jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.external_sources; v_candidate uuid; v_submission public.external_link_submissions; v_run uuid; v_city text; v_price numeric; v_class text; v_warnings text[]; v_text text; v_added integer;
begin
 if not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'Profile required' using errcode='42501'; end if;
 select * into s from public.external_sources where slug=p_source_slug and submission_enabled and status in ('link_only','authorized');
 if s.id is null then raise exception 'Source submission is unavailable' using errcode='23514'; end if;
 if p_url is null or char_length(p_url)>2048 or p_external_id is null or p_external_id !~ '^[0-9]{1,30}$' then raise exception 'Invalid external URL' using errcode='23514'; end if;
 if not (substring(p_url from '^https://([^/]+)/')=any(s.allowed_hosts)) then raise exception 'Source host is not configured' using errcode='23514'; end if;
 if not ((s.slug='facebook_marketplace' and p_url='https://www.facebook.com/marketplace/item/'||p_external_id)
  or (s.slug='freecycle' and p_url='https://www.freecycle.org/posts/'||p_external_id)
  or (s.slug='craigslist' and p_url ~ '^https://[a-z0-9-]+\.craigslist\.org/([a-z]{3}/)?zip/d/[a-z0-9-]+/[0-9]{5,20}\.html$' and p_url like '%/'||p_external_id||'.html')) then raise exception 'URL does not match the configured source' using errcode='23514'; end if;
 if p_evidence is null or jsonb_typeof(p_evidence)<>'object' or p_evidence->>'notesOwned' is distinct from 'true' or char_length(btrim(coalesce(p_evidence->>'title',''))) not between 1 and 120 or char_length(btrim(coalesce(p_evidence->>'notes',''))) not between 1 and 1000 then raise exception 'Provide your own title and notes' using errcode='23514'; end if;
 if p_evidence->>'kind' is null or p_evidence->>'kind' not in ('offer','wanted','rental','service') or p_evidence->>'availability' is null or p_evidence->>'availability' not in ('unverified','unavailable','expired') then raise exception 'Invalid offer evidence' using errcode='23514'; end if;
 if coalesce(p_evidence->>'price','')<>'' then v_price:=(p_evidence->>'price')::numeric;if v_price<0 or v_price>1000000 then raise exception 'Invalid price' using errcode='23514'; end if; end if;
 if char_length(coalesce(p_evidence->>'city',''))>100 or char_length(coalesce(p_evidence->>'neighborhood',''))>100 then raise exception 'Invalid location' using errcode='23514'; end if;
 select city into v_city from unnest(s.coverage_cities) city where lower(city)=lower(btrim(p_evidence->>'city'));
 if nullif(btrim(p_evidence->>'city'),'') is not null and v_city is null then raise exception 'City is outside the configured coverage' using errcode='23514'; end if;
 v_text:=lower((p_evidence->>'title')||' '||(p_evidence->>'notes'));
 v_class:=case when p_evidence->>'kind'<>'offer' or p_evidence->>'availability'<>'unverified' or (v_price is not null and v_price<>0) or v_text ~ '\m(wanted|iso|rental|sold|claimed|obo)\M|looking for|for rent|free shipping|free with purchase|donation required|delivery fee|deposit|starting at|make an offer|no longer available' or exists(select 1 from regexp_matches(v_text,'[$£€][[:space:]]*([0-9]+(\.[0-9]+)?)','g') as money(parts) where (parts[1])::numeric>0) then 'rejected'
  when v_price is null or v_text !~ '\m(free|giving away|no charge|zero cost)\M|\$0([^0-9]|$)' then 'needs_review' else 'reported_free' end;
 v_warnings:=array['User-reported information only; source content was not fetched.','Availability and publication rights are unverified.'];
 if v_class<>'reported_free' then v_warnings:=array_append(v_warnings,'Not a confirmed free offer; do not publish.');end if;
 if v_city is null then v_warnings:=array_append(v_warnings,'City is missing.');end if;
 perform pg_advisory_xact_lock(hashtextextended('external-submit:'||p_user_id::text,0));
 select sub.* into v_submission from public.external_link_submissions sub join public.external_listing_candidates c on c.id=sub.candidate_id where sub.user_id=p_user_id and c.source_id=s.id and c.external_id=p_external_id;
 if v_submission.id is not null then return jsonb_build_object('id',v_submission.id,'status','received','classification',v_submission.free_classification,'warnings',v_submission.warnings);end if;
 if (select count(*) from public.external_link_submissions where user_id=p_user_id and created_at>=(date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'))>=10 then raise exception 'Daily link submission limit reached' using errcode='P0001';end if;
 insert into public.external_listing_candidates(source_id,external_id,canonical_url,warnings) values(s.id,p_external_id,p_url,v_warnings) on conflict(source_id,external_id) do nothing;
 get diagnostics v_added=row_count;
 select id into v_candidate from public.external_listing_candidates where source_id=s.id and external_id=p_external_id;
 insert into public.external_link_submissions(user_id,candidate_id,source_id,original_url,original_title,original_notes,reported_price,offer_kind,reported_availability,city,neighborhood,notes_owned,free_classification,warnings)
 values(p_user_id,v_candidate,s.id,p_url,btrim(p_evidence->>'title'),btrim(p_evidence->>'notes'),v_price,p_evidence->>'kind',p_evidence->>'availability',v_city,nullif(btrim(p_evidence->>'neighborhood'),''),true,v_class,v_warnings) returning * into v_submission;
 insert into public.external_discovery_runs(source_id,mode,status,finished_at,items_seen,items_queued,summary) values(s.id,'user_url','completed',now(),1,v_added,'Received a user URL and original notes; no marketplace content was accessed.') returning id into v_run;
 return jsonb_build_object('id',v_submission.id,'status','received','classification',v_class,'warnings',v_warnings);
end;
$$;
revoke all on function public.receive_external_link(uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.receive_external_link(uuid,text,text,text,jsonb) to service_role;
commit;
