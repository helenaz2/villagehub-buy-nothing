select jsonb_build_object(
 'existing_tables',(select coalesce(jsonb_agg(c.relname),'[]'::jsonb) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('categories','listings','listing_photos','saved_items')),
 'existing_functions',(select coalesce(jsonb_agg(p.proname),'[]'::jsonb) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('publish_listing_photos','villagehub_validate_listing')),
 'listing_bucket_exists',exists(select 1 from storage.buckets where id='listing-photos'),
 'phase1_applied',exists(select 1 from supabase_migrations.schema_migrations where version='20261114000100')
) as phase2_preflight;
