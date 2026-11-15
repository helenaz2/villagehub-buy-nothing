select jsonb_build_object(
 'publication',(select jsonb_agg(tablename) from pg_publication_tables where pubname='supabase_realtime'),
 'policies',(select jsonb_agg(jsonb_build_object('table',tablename,'roles',roles,'expression',qual)) from pg_policies where schemaname='public' and tablename in ('messages','conversations','conversation_members')),
 'publication_flags',(select jsonb_build_object('insert',pubinsert,'update',pubupdate) from pg_publication where pubname='supabase_realtime'),
 'grants',(select jsonb_agg(jsonb_build_object('table',table_name,'role',grantee,'privilege',privilege_type)) from information_schema.role_table_grants where table_schema='public' and table_name='messages')
) as realtime_checks;
