select jsonb_build_object(
 'conflicting_tables',(select coalesce(jsonb_agg(tablename),'[]'::jsonb) from pg_tables where schemaname='public' and tablename in ('rating_jobs','rating_invitations','ratings')),
 'conflicting_functions',(select coalesce(jsonb_agg(proname),'[]'::jsonb) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in ('enqueue_rating_job','process_rating_jobs','submit_conversation_rating','dismiss_rating_invitation','get_rating_stats','invoke_rating_worker')),
 'extensions',(select jsonb_agg(jsonb_build_object('name',name,'installed',installed_version,'available',default_version)) from pg_available_extensions where name in ('pg_cron','pg_net','supabase_vault')),
 'applied_migrations',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations)
) as phase4_preflight;
