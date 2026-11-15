begin;
create table public.category_proposals (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id),
 client_key text not null check(char_length(client_key) between 1 and 100),
 name text not null check(char_length(name) between 2 and 40),
 reason text not null check(char_length(reason) between 5 and 500),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 category_id uuid references public.categories(id),
 message text not null default 'Saved for AI review.',
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 unique(user_id,client_key)
);
create index category_proposals_user_idx on public.category_proposals(user_id,created_at desc);
create table public.ai_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id),
 kind text not null check(kind in ('category','photo')),
 request_key text not null check(char_length(request_key) between 1 and 100),
 payload_hash text not null check(payload_hash ~ '^[0-9a-f]{64}$'),
 proposal_id uuid references public.category_proposals(id) on delete cascade,
 status text not null default 'working' check(status in ('working','succeeded','failed')),
 attempts integer not null default 1,
 reservation uuid not null default gen_random_uuid(),
 lease_until timestamptz not null default now()+interval '2 minutes',
 result jsonb,
 created_at timestamptz not null default now(),
 unique(user_id,kind,request_key)
);
create table public.ai_daily_usage (
 day date not null,
 scope text not null,
 calls integer not null default 0,
 primary key(day,scope)
);
alter table public.category_proposals enable row level security;
alter table public.ai_requests enable row level security;
alter table public.ai_daily_usage enable row level security;
revoke all on public.category_proposals,public.ai_requests,public.ai_daily_usage from public,anon,authenticated;
grant select on public.category_proposals to authenticated;
grant all on public.category_proposals,public.ai_requests,public.ai_daily_usage to service_role;
create policy category_proposal_owner_read on public.category_proposals for select to authenticated using(user_id=(select auth.uid()));

create function public.create_category_proposal(p_name text,p_reason text,p_client_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_name text:=initcap(regexp_replace(btrim(p_name),'\s+',' ','g')); v_existing public.category_proposals; v_category public.categories;
begin
 if auth.uid() is null then raise exception 'Sign in first' using errcode='42501'; end if;
 if v_name is null or char_length(v_name) not between 2 and 40 or v_name !~ '^[[:alnum:]][[:alnum:] &''-]*$' or lower(v_name) in ('all','for you') or p_reason is null or char_length(btrim(p_reason)) not between 5 and 500 or p_client_key is null or char_length(p_client_key) not between 1 and 100 then
  raise exception 'Enter a valid category name and reason' using errcode='23514';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('villagehub-proposals:'||auth.uid()::text,0));
 select * into v_existing from public.category_proposals where user_id=auth.uid() and client_key=p_client_key;
 if v_existing.id is not null then
  if lower(v_existing.name)<>lower(v_name) or v_existing.reason<>btrim(p_reason) then raise exception 'Request key already used' using errcode='23514'; end if;
  return to_jsonb(v_existing);
 end if;
 if (select count(*) from public.category_proposals where user_id=auth.uid() and created_at>=(date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'))>=10 then raise exception 'Daily proposal limit reached' using errcode='P0001'; end if;
 select * into v_category from public.categories where lower(name)=lower(v_name);
 insert into public.category_proposals(user_id,client_key,name,reason,status,category_id,message,reviewed_at)
 values(auth.uid(),p_client_key,coalesce(v_category.name,v_name),btrim(p_reason),case when v_category.id is null then 'pending' else 'approved' end,v_category.id,case when v_category.id is null then 'Saved for AI review.' else 'This category is already available.' end,case when v_category.id is not null then now() end)
 returning * into v_existing;
 return to_jsonb(v_existing);
end;
$$;
revoke all on function public.create_category_proposal(text,text,text) from public,anon,authenticated;
grant execute on function public.create_category_proposal(text,text,text) to authenticated;

-- A single transaction serializes quota checks and retry reservations. Only an
-- authenticated Edge handler with the service key can reserve a paid call.
create function public.reserve_ai_request(p_user_id uuid,p_kind text,p_request_key text,p_payload_hash text,p_proposal_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.ai_requests; v_day date:=(now() at time zone 'UTC')::date; v_user_scope text:='user:'||p_user_id::text;
begin
 if p_user_id is null or not exists(select 1 from public.profiles where id=p_user_id) or p_kind not in ('category','photo') or p_kind is null or p_request_key is null or char_length(p_request_key) not between 1 and 100 or p_payload_hash is null or p_payload_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid AI request' using errcode='23514'; end if;
 if p_kind='category' and not exists(select 1 from public.category_proposals where id=p_proposal_id and user_id=p_user_id and status='pending') then raise exception 'Own pending proposal required' using errcode='42501'; end if;
 if p_kind='photo' and p_proposal_id is not null then raise exception 'Invalid proposal reference' using errcode='23514'; end if;
 perform pg_advisory_xact_lock(hashtextextended('villagehub-ai-quota',0));
 select * into r from public.ai_requests where user_id=p_user_id and kind=p_kind and request_key=p_request_key for update;
 if r.id is not null then
  if r.payload_hash<>p_payload_hash or r.proposal_id is distinct from p_proposal_id then raise exception 'Request key already used' using errcode='23514'; end if;
  if r.status='succeeded' then return jsonb_build_object('status','cached','result',r.result); end if;
  if r.status='working' and r.lease_until>now() then return jsonb_build_object('status','busy'); end if;
  if r.attempts>=3 then return jsonb_build_object('status','exhausted'); end if;
 end if;
 insert into public.ai_daily_usage(day,scope) values(v_day,'global'),(v_day,v_user_scope) on conflict do nothing;
 if (select calls from public.ai_daily_usage where day=v_day and scope='global')>=100 or (select calls from public.ai_daily_usage where day=v_day and scope=v_user_scope)>=10 then return jsonb_build_object('status','limited'); end if;
 update public.ai_daily_usage set calls=calls+1 where day=v_day and scope in ('global',v_user_scope);
 if r.id is null then
  insert into public.ai_requests(user_id,kind,request_key,payload_hash,proposal_id) values(p_user_id,p_kind,p_request_key,p_payload_hash,p_proposal_id) returning * into r;
 else
  update public.ai_requests set status='working',attempts=attempts+1,reservation=gen_random_uuid(),lease_until=now()+interval '2 minutes' where id=r.id returning * into r;
 end if;
 return jsonb_build_object('status','reserved','id',r.id,'reservation',r.reservation);
end;
$$;
create function public.finish_ai_request(p_id uuid,p_reservation uuid,p_success boolean,p_result jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.ai_requests; p public.category_proposals; c public.categories; v_result jsonb:=p_result;
begin
 select * into r from public.ai_requests where id=p_id for update;
 if r.id is null or r.reservation<>p_reservation or r.status<>'working' then raise exception 'AI reservation expired' using errcode='23514'; end if;
 if p_success is null or p_result is null or octet_length(p_result::text)>16000 then raise exception 'Invalid result' using errcode='23514'; end if;
 if r.kind='category' and p_success then
  if p_result->>'status' is null or p_result->>'status' not in ('approved','rejected') or char_length(coalesce(p_result->>'message','')) not between 1 and 500 then raise exception 'Invalid review decision' using errcode='23514'; end if;
  select * into p from public.category_proposals where id=r.proposal_id and user_id=r.user_id for update;
  if p.id is null or p.status<>'pending' then raise exception 'Proposal is no longer pending' using errcode='23514'; end if;
  if p_result->>'status'='approved' then
   insert into public.categories(name,sort_order) values(p.name,100)
   on conflict((lower(name))) do update set name=public.categories.name returning * into c;
  end if;
  update public.category_proposals set status=p_result->>'status',category_id=c.id,message=p_result->>'message',reviewed_at=now() where id=p.id;
  v_result:=jsonb_build_object('status',p_result->>'status','name',coalesce(c.name,p.name),'message',p_result->>'message','source','server');
 elsif r.kind='category' then
  update public.category_proposals set message='AI review unavailable. Your proposal is saved; retry later.' where id=r.proposal_id;
 end if;
 update public.ai_requests set status=case when p_success then 'succeeded' else 'failed' end,result=case when p_success then v_result else null end where id=r.id;
 return v_result;
end;
$$;
revoke all on function public.reserve_ai_request(uuid,text,text,text,uuid),public.finish_ai_request(uuid,uuid,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.reserve_ai_request(uuid,text,text,text,uuid),public.finish_ai_request(uuid,uuid,boolean,jsonb) to service_role;
alter publication supabase_realtime add table public.categories;
commit;
