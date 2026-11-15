begin;
create table public.rating_jobs (
 conversation_id uuid primary key references public.conversations(id) on delete cascade,
 sequence bigint not null,
 due_at timestamptz not null,
 delivered_sequence bigint
);
create index rating_jobs_due_idx on public.rating_jobs(due_at) where delivered_sequence is null;
create table public.rating_invitations (
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 user_id uuid not null references public.profiles(id),
 sequence bigint not null,
 available_at timestamptz,
 dismissed_at timestamptz,
 primary key(conversation_id,user_id)
);
create table public.ratings (
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 rater_id uuid not null references public.profiles(id),
 ratee_id uuid not null references public.profiles(id),
 stars smallint not null check(stars between 1 and 5),
 created_at timestamptz not null default clock_timestamp(),
 primary key(conversation_id,rater_id),
 check(rater_id<>ratee_id)
);
create index ratings_ratee_idx on public.ratings(ratee_id);
alter table public.rating_jobs enable row level security;
alter table public.rating_invitations enable row level security;
alter table public.ratings enable row level security;
revoke all on public.rating_jobs,public.rating_invitations,public.ratings from anon,authenticated;
grant select on public.rating_invitations,public.ratings to authenticated;
grant all on public.rating_jobs,public.rating_invitations,public.ratings to service_role;
create policy invitation_owner_read on public.rating_invitations for select to authenticated using(user_id=(select auth.uid()));
create policy rating_participant_read on public.ratings for select to authenticated using(public.is_conversation_participant(conversation_id));

create function public.enqueue_rating_job() returns trigger language plpgsql security definer set search_path='' as $$
begin
 -- send_message already holds the conversation lock. Workers use the same lock
 -- order (conversation, then job), avoiding races with a resumed conversation.
 insert into public.rating_jobs(conversation_id,sequence,due_at)
 values(new.conversation_id,new.sequence,new.created_at+interval '5 minutes')
 on conflict(conversation_id) do update set sequence=excluded.sequence,due_at=excluded.due_at,delivered_sequence=null;
 update public.rating_invitations i set available_at=null,dismissed_at=null,sequence=new.sequence
 where i.conversation_id=new.conversation_id and not exists(select 1 from public.ratings r where r.conversation_id=i.conversation_id and r.rater_id=i.user_id);
 return new;
end;
$$;
revoke all on function public.enqueue_rating_job() from public,anon,authenticated;
create trigger enqueue_rating_after_message after insert on public.messages for each row execute function public.enqueue_rating_job();
-- Preserve eligibility for existing conversations without changing their messages.
insert into public.rating_jobs(conversation_id,sequence,due_at)
select id,last_sequence,last_message_at+interval '5 minutes' from public.conversations where last_sequence>0;

create function public.process_rating_jobs() returns integer language plpgsql security definer set search_path='' as $$
declare c public.conversations; j public.rating_jobs; v_count integer:=0;
begin
 for c in select conv.* from public.conversations conv join public.rating_jobs job on job.conversation_id=conv.id
   where job.delivered_sequence is null and job.due_at<=clock_timestamp()
   order by job.due_at limit 100 for update of conv skip locked
 loop
   select * into j from public.rating_jobs where conversation_id=c.id for update;
   if j.due_at>clock_timestamp() or j.sequence<>c.last_sequence then continue; end if;
   if exists(select 1 from public.messages where conversation_id=c.id and sender_id=c.host_id)
      and exists(select 1 from public.messages where conversation_id=c.id and sender_id=c.requester_id) then
     insert into public.rating_invitations(conversation_id,user_id,sequence,available_at)
     select c.id,participant,j.sequence,clock_timestamp() from unnest(array[c.host_id,c.requester_id]) participant
     where not exists(select 1 from public.ratings where conversation_id=c.id and rater_id=participant)
     on conflict(conversation_id,user_id) do update set sequence=excluded.sequence,available_at=excluded.available_at,dismissed_at=null;
     v_count:=v_count+1;
   end if;
   update public.rating_jobs set delivered_sequence=j.sequence where conversation_id=c.id;
 end loop;
 return v_count;
end;
$$;
revoke all on function public.process_rating_jobs() from public,anon,authenticated;
grant execute on function public.process_rating_jobs() to service_role;

create function public.submit_conversation_rating(p_conversation_id uuid,p_stars integer) returns void
language plpgsql security definer set search_path='' as $$
declare c public.conversations; i public.rating_invitations; existing integer;
begin
 select * into c from public.conversations where id=p_conversation_id for update;
 if auth.uid() is null or c.id is null or auth.uid() not in(c.host_id,c.requester_id) then raise exception 'Participants only' using errcode='42501'; end if;
 if p_stars is null or p_stars not between 1 and 5 then raise exception 'Choose 1 to 5 stars' using errcode='23514'; end if;
 select stars into existing from public.ratings where conversation_id=c.id and rater_id=auth.uid();
 if existing is not null then
   if existing<>p_stars then raise exception 'Your rating has already been submitted' using errcode='23514'; end if;
   return;
 end if;
 select * into i from public.rating_invitations where conversation_id=c.id and user_id=auth.uid();
 if i.available_at is null or i.available_at>clock_timestamp() or i.sequence<>c.last_sequence or c.last_message_at+interval '5 minutes'>clock_timestamp() then
   raise exception 'Rating invitation is not ready yet' using errcode='23514';
 end if;
 insert into public.ratings(conversation_id,rater_id,ratee_id,stars)
 values(c.id,auth.uid(),case when auth.uid()=c.host_id then c.requester_id else c.host_id end,p_stars);
end;
$$;
create function public.dismiss_rating_invitation(p_conversation_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first' using errcode='42501'; end if;
 update public.rating_invitations set dismissed_at=clock_timestamp()
 where conversation_id=p_conversation_id and user_id=auth.uid() and available_at is not null;
end;
$$;
create function public.get_rating_stats(p_user_ids uuid[]) returns table(user_id uuid,average_rating numeric,rating_count bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first' using errcode='42501'; end if;
 if cardinality(p_user_ids)>100 then raise exception 'Request at most 100 profiles' using errcode='23514'; end if;
 return query select r.ratee_id,round(avg(r.stars),2),count(*) from public.ratings r where r.ratee_id=any(p_user_ids) group by r.ratee_id;
end;
$$;
revoke all on function public.submit_conversation_rating(uuid,integer),public.dismiss_rating_invitation(uuid),public.get_rating_stats(uuid[]) from public,anon,authenticated;
grant execute on function public.submit_conversation_rating(uuid,integer),public.dismiss_rating_invitation(uuid),public.get_rating_stats(uuid[]) to authenticated;
alter publication supabase_realtime add table public.rating_invitations,public.ratings;
-- Postgres DELETE events cannot be authorized with row SELECT policies. This
-- application uses per-user hiding, so no client needs replication of deletes.
-- Fail rather than change another application's publication behavior.
do $$ begin
 if exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and (schemaname<>'public' or tablename not in ('conversations','conversation_members','messages','rating_invitations','ratings'))) then
   raise exception 'Review other Realtime tables before changing publication events';
 end if;
end $$;
alter publication supabase_realtime set (publish='insert,update');

-- The worker uses a dedicated invocation key, never a public/Expo key. Missing
-- configuration is a safe no-op. Secrets are configured separately after approval.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create function public.invoke_rating_worker() returns bigint language plpgsql security definer set search_path='' as $$
declare v_url text; v_key text; v_request bigint;
begin
 if not exists(select 1 from public.rating_jobs where delivered_sequence is null and due_at<=clock_timestamp()) then return null; end if;
 select decrypted_secret into v_url from vault.decrypted_secrets where name='villagehub_rating_worker_url';
 select decrypted_secret into v_key from vault.decrypted_secrets where name='villagehub_rating_worker_key';
 if v_url is null or v_key is null then return null; end if;
 select net.http_post(url:=v_url,headers:=jsonb_build_object('Content-Type','application/json','x-worker-key',v_key),body:='{}'::jsonb,timeout_milliseconds:=10000) into v_request;
 return v_request;
end;
$$;
revoke all on function public.invoke_rating_worker() from public,anon,authenticated,service_role;
select cron.schedule('villagehub-rating-invitations','* * * * *','select public.invoke_rating_worker();');
commit;
