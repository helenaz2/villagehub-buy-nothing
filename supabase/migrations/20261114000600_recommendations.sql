-- Extend the existing quota namespace; preserve the Phase 5 policies and limits.
begin;
alter table public.ai_requests drop constraint ai_requests_kind_check;
alter table public.ai_requests add constraint ai_requests_kind_check check(kind in ('category','photo','recommendation'));
create or replace function public.reserve_ai_request(p_user_id uuid,p_kind text,p_request_key text,p_payload_hash text,p_proposal_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.ai_requests; v_day date:=(now() at time zone 'UTC')::date; v_user_scope text:='user:'||p_user_id::text; v_burst_scope text;
begin
 if p_user_id is null or not exists(select 1 from public.profiles where id=p_user_id) or p_kind not in ('category','photo','recommendation') or p_kind is null or p_request_key is null or char_length(p_request_key) not between 1 and 100 or p_payload_hash is null or p_payload_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid AI request' using errcode='23514'; end if;
 if p_kind='category' and not exists(select 1 from public.category_proposals where id=p_proposal_id and user_id=p_user_id and status='pending') then raise exception 'Own pending proposal required' using errcode='42501'; end if;
 if p_kind<>'category' and p_proposal_id is not null then raise exception 'Invalid proposal reference' using errcode='23514'; end if;
 perform pg_advisory_xact_lock(hashtextextended('villagehub-ai-quota',0));
 if p_kind='recommendation' then
  v_burst_scope:='recommendation-minute:'||p_user_id::text||':'||to_char(now() at time zone 'UTC','HH24MI');
  insert into public.ai_daily_usage(day,scope) values(v_day,v_burst_scope) on conflict do nothing;
  if (select calls from public.ai_daily_usage where day=v_day and scope=v_burst_scope)>=20 then return jsonb_build_object('status','throttled'); end if;
  update public.ai_daily_usage set calls=calls+1 where day=v_day and scope=v_burst_scope;
 end if;
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

revoke all on function public.reserve_ai_request(uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.reserve_ai_request(uuid,text,text,text,uuid) to service_role;
-- Reuse the existing GIN-indexed search_document for item terms. Additional
-- material/color/feature checks only narrow those matches; no vector store,
-- duplicated listing table, or backfill of existing listing timestamps is needed.
create function public.search_listing_recommendations(
 p_items text[],p_attributes jsonb default '[]',p_city text default null,
 p_neighborhood text default null,p_preferred_city text default null
) returns table(id uuid,title text,city text,neighborhood text,status text,object_path text)
language plpgsql stable security invoker set search_path='' as $$
declare v_items tsquery; v_attributes tsquery; v_group tsquery; v_terms jsonb; v_term text;
begin
 if auth.uid() is null then raise exception 'Sign in first' using errcode='42501'; end if;
 if p_items is null or cardinality(p_items) not between 1 and 6 or array_position(p_items,null) is not null
   or p_attributes is null or jsonb_typeof(p_attributes)<>'array' then raise exception 'Invalid search terms' using errcode='23514'; end if;
 if jsonb_array_length(p_attributes)>3 or char_length(coalesce(p_city,''))>100 or char_length(coalesce(p_neighborhood,''))>100 or char_length(coalesce(p_preferred_city,''))>100 then raise exception 'Invalid search filters' using errcode='23514'; end if;
 foreach v_term in array p_items loop
   if char_length(btrim(v_term)) not between 1 and 40 then raise exception 'Invalid item term' using errcode='23514'; end if;
   v_items:=case when v_items is null then phraseto_tsquery('english',v_term) else v_items || phraseto_tsquery('english',v_term) end;
 end loop;
 if numnode(v_items)=0 then return; end if;
 for v_terms in select value from jsonb_array_elements(p_attributes) loop
   if jsonb_typeof(v_terms)<>'array' then raise exception 'Invalid attribute group' using errcode='23514'; end if;
   if jsonb_array_length(v_terms) not between 1 and 6 or exists(select 1 from jsonb_array_elements(v_terms) t where jsonb_typeof(t)<>'string') then raise exception 'Invalid attribute terms' using errcode='23514'; end if;
   v_group:=null;
   for v_term in select jsonb_array_elements_text(v_terms) loop
     if char_length(btrim(v_term)) not between 1 and 40 then raise exception 'Invalid attribute term' using errcode='23514'; end if;
     v_group:=case when v_group is null then phraseto_tsquery('english',v_term) else v_group || phraseto_tsquery('english',v_term) end;
   end loop;
   if numnode(v_group)=0 then return; end if;
   v_attributes:=case when v_attributes is null then v_group else v_attributes && v_group end;
 end loop;
 return query select l.id,l.title,l.city,l.neighborhood,l.status,p.object_path
 from public.listings l
 join lateral (select photo.object_path from public.listing_photos photo where photo.listing_id=l.id order by photo.position limit 1) p on true
 where l.status='available' and l.search_document @@ v_items
   and (v_attributes is null or (l.search_document || to_tsvector('english',l.materials||' '||l.fabric||' '||l.color||' '||array_to_string(l.features,' '))) @@ v_attributes)
   and (p_city is null or lower(btrim(l.city))=lower(btrim(p_city)))
   and (p_neighborhood is null or lower(btrim(l.neighborhood))=lower(btrim(p_neighborhood)))
 order by case when p_preferred_city is not null and lower(btrim(l.city))=lower(btrim(p_preferred_city)) then 0 else 1 end,
 l.created_at desc,l.id desc limit 8;
end;
$$;
revoke all on function public.search_listing_recommendations(text[],jsonb,text,text,text) from public,anon,authenticated;
grant execute on function public.search_listing_recommendations(text[],jsonb,text,text,text) to authenticated;
commit;
