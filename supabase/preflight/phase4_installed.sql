select jsonb_build_object(
 'migration_applied',exists(select 1 from supabase_migrations.schema_migrations where version='20261114000400'),
 'tables',(select jsonb_agg(jsonb_build_object('name',relname,'rls',relrowsecurity)) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relname in ('ratings','rating_jobs','rating_invitations')),
 'publication',(select jsonb_build_object('insert',pubinsert,'update',pubupdate,'delete',pubdelete) from pg_publication where pubname='supabase_realtime'),
 'job',(select jsonb_agg(jsonb_build_object('name',jobname,'schedule',schedule,'active',active)) from cron.job where jobname='villagehub-rating-invitations'),
 'worker_execute_authenticated',has_function_privilege('authenticated','public.process_rating_jobs()','execute'),
 'worker_execute_service',has_function_privilege('service_role','public.process_rating_jobs()','execute'),
 'vault_url_exists',exists(select 1 from vault.secrets where name='villagehub_rating_worker_url'),
 'vault_key_exists',exists(select 1 from vault.secrets where name='villagehub_rating_worker_key')
) as phase4_installed;
