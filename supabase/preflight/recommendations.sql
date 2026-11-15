select jsonb_build_object(
 'search_function_exists',to_regprocedure('public.search_listing_recommendations(text[],jsonb,text,text,text)') is not null,
 'listing_indexes',(select jsonb_agg(indexdef) from pg_indexes where schemaname='public' and tablename='listings'),
 'quota_kind_constraint',(select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.ai_requests'::regclass and conname='ai_requests_kind_check'),
 'profile_columns',(select jsonb_agg(column_name) from information_schema.columns where table_schema='public' and table_name='profiles'),
 'applied_migrations',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations)
) as recommendation_preflight;
