begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

-- Two distinct users. All fixtures are rolled back at the end of this test.
insert into auth.users (id, email, raw_user_meta_data) values
('11111111-1111-4111-8111-111111111111', 'alice@example.test', '{"full_name":"Alice","city":"Brooklyn","state":"New York"}'),
('22222222-2222-4222-8222-222222222222', 'bob@example.test', '{"full_name":"Bob","city":"Los Angeles","state":"California"}');
select is((select count(*)::int from public.profiles where id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222')), 2, 'signup trigger creates profiles');
select is((select count(*)::int from public.us_states), 51, '50 states and DC');
select ok(not exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name in ('street','email','password','rating')), 'public profiles exclude sensitive fields and client-controlled rating');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select is((select count(*)::int from public.profiles), 2, 'Alice can view general profiles');
select lives_ok($$update public.profiles set bio='Hello neighbors' where id='11111111-1111-4111-8111-111111111111'$$, 'Alice can update own bio');
select is((select bio from public.profiles where id='11111111-1111-4111-8111-111111111111'), 'Hello neighbors', 'own update persisted');
with changed as (update public.profiles set full_name='Hacked' where id='22222222-2222-4222-8222-222222222222' returning id) select is(count(*)::int, 0, 'Alice cannot edit Bob') from changed;
select throws_ok($$update public.profiles set id='22222222-2222-4222-8222-222222222222' where id='11111111-1111-4111-8111-111111111111'$$, '42501', null, 'cannot change profile identity');
select throws_ok($$update public.profiles set created_at='2000-01-01' where id='11111111-1111-4111-8111-111111111111'$$, '42501', null, 'cannot forge membership date');
select throws_ok($$update public.profiles set state='Not a state' where id='11111111-1111-4111-8111-111111111111'$$, '23503', null, 'state validated by database');
select throws_ok($$update public.profiles set full_name=' ' where id='11111111-1111-4111-8111-111111111111'$$, '23514', null, 'blank name rejected');
select lives_ok($$insert into public.account_addresses (user_id,street) values ('11111111-1111-4111-8111-111111111111','123 Sample Street')$$, 'Alice can save own street');
select throws_ok($$insert into public.account_addresses (user_id,street) values ('22222222-2222-4222-8222-222222222222','Injected')$$, '42501', null, 'Alice cannot insert Bobs private address');
select throws_ok($$delete from public.profiles where id='11111111-1111-4111-8111-111111111111'$$, '42501', null, 'account deletion requires separate server flow');

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select is((select count(*)::int from public.account_addresses), 0, 'Bob cannot read Alice street');
with changed as (update public.account_addresses set street='Injected' where user_id='11111111-1111-4111-8111-111111111111' returning user_id) select is(count(*)::int, 0, 'Bob cannot update Alice street') from changed;
select lives_ok($$insert into public.account_addresses (user_id,street) values ('22222222-2222-4222-8222-222222222222',null)$$, 'street is optional');
select is((select full_name from public.profiles where id='22222222-2222-4222-8222-222222222222'), 'Bob', 'Bob profile unchanged by Alice');

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok($$select * from public.profiles$$, '42501', null, 'signed-out requests cannot read profiles');
select throws_ok($$select * from public.account_addresses$$, '42501', null, 'signed-out requests cannot read streets');
reset role;
select * from finish();
rollback;
