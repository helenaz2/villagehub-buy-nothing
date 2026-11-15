begin;

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete set null,
  host_id uuid not null references public.profiles(id),
  requester_id uuid not null references public.profiles(id),
  listing_title text not null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  last_sequence bigint not null default 0,
  last_sender_id uuid references public.profiles(id),
  preview text not null default '',
  unique (listing_id,requester_id),
  check (host_id<>requester_id)
);
create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  pinned boolean not null default false,
  hidden boolean not null default false,
  last_read_sequence bigint not null default 0 check (last_read_sequence>=0),
  unread_override boolean,
  primary key (conversation_id,user_id)
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  sequence bigint not null check (sequence>0),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  client_key text not null check (char_length(client_key) between 1 and 100),
  created_at timestamptz not null default clock_timestamp(),
  unique(conversation_id,sequence),
  unique(conversation_id,sender_id,client_key)
);
create index conversations_host_idx on public.conversations(host_id,last_message_at desc);
create index conversations_requester_idx on public.conversations(requester_id,last_message_at desc);
create index conversation_members_user_idx on public.conversation_members(user_id,hidden);
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
revoke all on public.conversations,public.conversation_members,public.messages from anon,authenticated;
grant select on public.conversations,public.conversation_members,public.messages to authenticated;
grant update(pinned,hidden,unread_override) on public.conversation_members to authenticated;

create function public.is_conversation_participant(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.conversations where id=p_id and auth.uid() in (host_id,requester_id));
$$;
revoke all on function public.is_conversation_participant(uuid) from public,anon,authenticated;
grant execute on function public.is_conversation_participant(uuid) to authenticated;
create policy conversation_participant_read on public.conversations for select to authenticated
 using ((select auth.uid()) in (host_id,requester_id));
create policy message_participant_read on public.messages for select to authenticated
 using (public.is_conversation_participant(conversation_id));
create policy member_owner_read on public.conversation_members for select to authenticated
 using (user_id=(select auth.uid()));
create policy member_owner_update on public.conversation_members for update to authenticated
 using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

create function public.open_conversation(p_listing_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_listing public.listings; v_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first' using errcode='42501'; end if;
 select * into v_listing from public.listings where id=p_listing_id for share;
 if v_listing.id is null or v_listing.owner_id=auth.uid() then raise exception 'Choose another neighbor''s listing' using errcode='42501'; end if;
 select id into v_id from public.conversations where listing_id=p_listing_id and requester_id=auth.uid();
 if v_id is null then
   if v_listing.status<>'available' then raise exception 'Listing is unavailable' using errcode='23514'; end if;
   insert into public.conversations(listing_id,host_id,requester_id,listing_title)
   values(p_listing_id,v_listing.owner_id,auth.uid(),v_listing.title)
   on conflict(listing_id,requester_id) do update set listing_id=excluded.listing_id returning id into v_id;
   insert into public.conversation_members(conversation_id,user_id)
   values(v_id,v_listing.owner_id),(v_id,auth.uid()) on conflict do nothing;
 end if;
 update public.conversation_members set hidden=false where conversation_id=v_id and user_id=auth.uid();
 return v_id;
end;
$$;

-- All message writes are atomic RPCs. The row lock serializes sequence allocation,
-- previews, sender read receipts and idempotent retries for each conversation.
create function public.send_message(p_conversation_id uuid,p_body text,p_client_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_conversation public.conversations; v_message public.messages; v_id uuid; v_time timestamptz;
begin
 select * into v_conversation from public.conversations where id=p_conversation_id for update;
 if auth.uid() is null or v_conversation.id is null or auth.uid() not in (v_conversation.host_id,v_conversation.requester_id) then
   raise exception 'Conversation participants only' using errcode='42501';
 end if;
 if p_body is null or char_length(btrim(p_body)) not between 1 and 4000 or p_client_key is null or char_length(p_client_key) not between 1 and 100 then
   raise exception 'A message and valid retry key are required' using errcode='23514';
 end if;
 select * into v_message from public.messages where conversation_id=p_conversation_id and sender_id=auth.uid() and client_key=p_client_key;
 if v_message.id is not null then
   if v_message.body<>btrim(p_body) then raise exception 'Retry key already used for another message' using errcode='23514'; end if;
   return v_message.id;
 end if;
 v_time:=clock_timestamp();
 insert into public.messages(conversation_id,sender_id,sequence,body,client_key,created_at)
 values(p_conversation_id,auth.uid(),v_conversation.last_sequence+1,btrim(p_body),p_client_key,v_time) returning id into v_id;
 update public.conversations set last_sequence=last_sequence+1,last_message_at=v_time,last_sender_id=auth.uid(),preview=left(btrim(p_body),180) where id=p_conversation_id;
 update public.conversation_members set hidden=false,unread_override=null,
   last_read_sequence=case when user_id=auth.uid() then v_conversation.last_sequence+1 else last_read_sequence end
 where conversation_id=p_conversation_id;
 return v_id;
end;
$$;
create function public.mark_conversation_read(p_conversation_id uuid,p_sequence bigint) returns void
language plpgsql security definer set search_path='' as $$
declare v_conversation public.conversations;
begin
 select * into v_conversation from public.conversations where id=p_conversation_id for update;
 if auth.uid() is null or v_conversation.id is null or auth.uid() not in (v_conversation.host_id,v_conversation.requester_id) then
   raise exception 'Conversation participants only' using errcode='42501';
 end if;
 if p_sequence is null or p_sequence<0 or p_sequence>v_conversation.last_sequence then raise exception 'Invalid read sequence' using errcode='23514'; end if;
 update public.conversation_members set last_read_sequence=greatest(last_read_sequence,p_sequence),unread_override=null
 where conversation_id=p_conversation_id and user_id=auth.uid();
end;
$$;
revoke all on function public.open_conversation(uuid),public.send_message(uuid,text,text),public.mark_conversation_read(uuid,bigint) from public,anon,authenticated;
grant execute on function public.open_conversation(uuid),public.send_message(uuid,text,text),public.mark_conversation_read(uuid,bigint) to authenticated;

-- SELECT RLS is evaluated for each subscriber. No client can subscribe to another
-- user's preference rows or a conversation it does not participate in.
alter publication supabase_realtime add table public.conversations,public.conversation_members,public.messages;
commit;
