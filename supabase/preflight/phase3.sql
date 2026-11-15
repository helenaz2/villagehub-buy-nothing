select jsonb_build_object(
 'conflicting_tables',(select coalesce(jsonb_agg(tablename),'[]'::jsonb) from pg_tables where schemaname='public' and tablename in ('conversations','conversation_members','messages')),
 'conflicting_functions',(select coalesce(jsonb_agg(proname),'[]'::jsonb) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in ('is_conversation_participant','open_conversation','send_message','mark_conversation_read')),
 'realtime_publication_exists',exists(select 1 from pg_publication where pubname='supabase_realtime'),
 'applied_migrations',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations)
) as phase3_preflight;
