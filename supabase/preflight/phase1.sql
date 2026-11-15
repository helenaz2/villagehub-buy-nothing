-- Read-only metadata and counts. No rows, keys, passwords, or emails returned.
select jsonb_build_object(
  'database', current_database(),
  'postgres_version', current_setting('server_version'),
  'existing_target_tables', (
    select coalesce(jsonb_agg(c.relname order by c.relname), '[]'::jsonb)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('us_states','profiles','account_addresses')
  ),
  'existing_target_functions', (
    select coalesce(jsonb_agg(p.proname order by p.proname), '[]'::jsonb)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('set_updated_at','handle_new_user')
  ),
  'existing_auth_signup_triggers', (
    select coalesce(jsonb_agg(t.tgname order by t.tgname), '[]'::jsonb)
    from pg_trigger t where t.tgrelid='auth.users'::regclass and not t.tgisinternal
  ),
  'auth_user_count', (select count(*) from auth.users),
  'users_missing_signup_profile_metadata', (
    select count(*) from auth.users where
      nullif(btrim(raw_user_meta_data->>'full_name'),'') is null or
      nullif(btrim(raw_user_meta_data->>'city'),'') is null or
      nullif(btrim(raw_user_meta_data->>'state'),'') is null
  ),
  'migration_history_present', to_regclass('supabase_migrations.schema_migrations') is not null
) as phase1_preflight;
