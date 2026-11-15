select jsonb_build_object(
 'conflicting_tables',(select coalesce(jsonb_agg(tablename),'[]'::jsonb) from pg_tables where schemaname='public' and tablename in ('category_proposals','ai_requests','ai_daily_usage')),
 'conflicting_functions',(select coalesce(jsonb_agg(proname),'[]'::jsonb) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in ('create_category_proposal','reserve_ai_request','finish_ai_request')),
 'categories',(select jsonb_agg(jsonb_build_object('name',name,'sort_order',sort_order) order by sort_order,name) from public.categories),
 'publication_tables',(select jsonb_agg(tablename) from pg_publication_tables where pubname='supabase_realtime'),
 'applied_migrations',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations)
) as phase5_preflight;
