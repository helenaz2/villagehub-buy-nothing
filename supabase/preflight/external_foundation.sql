select jsonb_build_object(
 'existing_external_tables',(select coalesce(jsonb_agg(tablename),'[]'::jsonb) from pg_tables where schemaname='public' and tablename like 'external_%'),
 'reserved_profile_conflicts',(select count(*) from public.profiles where regexp_replace(lower(username),'[^a-z0-9]','','g') in ('villagehubbuynothing','villagehubofficial','villagehubadmin') or regexp_replace(lower(full_name),'[^a-z0-9]','','g') in ('villagehubbuynothing','villagehubofficial','villagehubadmin')),
 'profile_username_constraint',(select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.profiles'::regclass and conname='profiles_username_check'),
 'applied_migrations',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations)
) as external_foundation_preflight;
