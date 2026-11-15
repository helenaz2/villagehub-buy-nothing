-- Phase 1 grants profile updates per column. Include the new avatar field;
-- existing owner RLS, path validation and system-identity guards still apply.
grant update (avatar_path) on public.profiles to authenticated;
