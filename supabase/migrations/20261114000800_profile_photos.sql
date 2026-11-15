-- Private profile photos: authenticated neighbors can view the current avatar.
alter table public.profiles add column avatar_path text;
alter table public.profiles add constraint profiles_avatar_path_check check (
 avatar_path is null or (split_part(avatar_path,'/',1)=id::text and avatar_path ~ '^[0-9a-f-]{36}/[a-zA-Z0-9_-]+\.(jpg|png|webp)$')
);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('profile-photos','profile-photos',false,2097152,array['image/jpeg','image/png','image/webp']);
create policy villagehub_avatar_upload on storage.objects for insert to authenticated with check(
 bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid())::text
 and (select auth.uid()) is distinct from public.external_system_user_id()
);
create policy villagehub_avatar_read on storage.objects for select to authenticated using(
 bucket_id='profile-photos' and ((storage.foldername(name))[1]=(select auth.uid())::text
 or exists(select 1 from public.profiles p where p.avatar_path=name))
);
create policy villagehub_avatar_delete on storage.objects for delete to authenticated using(
 bucket_id='profile-photos' and (storage.foldername(name))[1]=(select auth.uid())::text
 and not exists(select 1 from public.profiles p where p.avatar_path=name)
);
create function public.validate_profile_avatar() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.avatar_path is not null and not exists(select 1 from storage.objects where bucket_id='profile-photos' and name=new.avatar_path) then
  raise exception 'Upload your profile photo before saving it' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function public.validate_profile_avatar() from public,anon,authenticated;
create trigger villagehub_validate_profile_avatar before insert or update of avatar_path on public.profiles
 for each row execute function public.validate_profile_avatar();
