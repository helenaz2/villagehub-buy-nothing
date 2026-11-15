-- Explicitly approved permission test. Simulates claims inside a transaction;
-- it creates no Auth session/token and rolls back every attempted write.
begin;
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',public.external_system_user_id()::text)::text,true);
set local role authenticated;
do $$ begin
 begin
  update public.profiles set bio='This mutation must fail' where id=auth.uid();
  raise exception 'TEST FAILED: authenticated system profile mutation was allowed';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.listings(owner_id,category_id,title,condition,size,color,neighborhood,city)
  values(auth.uid(),(select id from public.categories where name='Other'),'This mutation must fail','Fair','Small','White','Downtown','Berkeley');
  raise exception 'TEST FAILED: authenticated system post creation was allowed';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
