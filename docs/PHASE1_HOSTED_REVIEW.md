# Phase 1 hosted migration review

Target: existing project iwffztmzngpnwpolhzkc, ONLY after the owner confirms it
is disposable development data and explicitly approves this migration.

Status: APPLIED after explicit owner approval. Hosted two-account API verification passed.
This document is a change preview, not evidence of a successful migration.

## Exact database changes

File: supabase/migrations/20261114000100_phase1_profiles.sql

- Create public.us_states with 50 states and District of Columbia (51 rows).
- Create public.profiles: Auth user UUID, full name, unique username, bio, city,
  state, and server timestamps. No email, street, password or user-editable rating.
- Create public.account_addresses: Auth user UUID, optional private street,
  server timestamps. Each user can read/write only their own street.
- Enable RLS on all three tables and create seven access policies.
- Configure grants so signed-in users can read general profiles, create/edit
  only their own profile, and cannot change UUID/membership timestamps or delete
  profiles through the client API. Anonymous clients cannot read these tables.
- Create set_updated_at and handle_new_user functions, with restricted execution.
- Add three triggers: profile/address timestamps and profile creation after an
  Auth user signup. Username is generated from the real Auth UUID.
- Supabase CLI will record the applied migration in its migration-history schema.

No DROP, TRUNCATE, database reset, deletion of existing users, or edits to
existing application rows are included. Existing Auth users are NOT backfilled.
The migration uses a transaction and will fail rather than overwrite existing
objects. Preflight must verify that object names do not conflict first.

## Behavior/risk requiring approval

The signup trigger requires valid full_name, city and state metadata. The existing
signup UI sends these. New users created by other clients or the dashboard without
that metadata may fail until they use the app or a later onboarding adjustment.
A failing trigger can block new signups; do not apply to a shared/production app.

## Docker-free workflow

1. Owner runs npx --yes supabase@3.1.0 login in their own terminal and completes
   browser authentication. Do not paste access tokens/passwords into chat.
2. Inspect account/project identity and link only this project; linking changes
   local CLI metadata, not application tables.
3. Run read-only preflight using CLI v3 (no Docker):

       npx --yes supabase@3.1.0 db query --remote=iwffztmzngpnwpolhzkc --read-only --file supabase/preflight/phase1.sql

4. Preview only the pending migration list, skipping vault changes:

       npx --yes supabase@3.1.0 db push --remote=iwffztmzngpnwpolhzkc --dry-run --skip-vault

5. Present the preflight result and exact migration to the owner and obtain
   approval. Do not execute a real push before that approval.
6. Apply only this approved migration with --remote and --skip-vault. No seed,
   roles, unrelated migrations, database reset, or production changes.
7. Verify schema/policies with read-only queries. Test two real dedicated accounts.

## Real account verification

Keep email confirmation enabled. Prefer creating two dedicated accounts through
the existing signup UI with email addresses the owner controls and confirming
both emails. Configure the exact localhost callback/reset URLs in the dashboard.
Do not send passwords in chat or use a service-role key in the Expo app.

The hosted test harness will use only these accounts' normal credentials. It will
check profile persistence, public/private reads, cross-user edit denial and token
refresh. Any write tests must be limited to these accounts, with fixture changes
shown and approved separately; no automatic deletion of accounts or arbitrary
project data. Email callbacks, reset delivery and UI persistence also require
actual browser/device checks before Phase 1 can be declared verified.

Phases 2-5 remain gated by Phase 1 verification. All code stays in this repository.

## Recorded preflight

- Project: villagehub-buy-nothing, iwffztmzngpnwpolhzkc.
- CLI labels the main branch production; owner explicitly confirmed disposable development use.
- PostgreSQL 17.11; zero Auth users.
- No conflicting target tables, functions or signup triggers.
- No existing migration history.
- Dry-run lists only 20261114000100_phase1_profiles.sql; no seeds or custom roles.
- Migration SHA-256: D0649F0E2FB6B5A88E4DC7E7DE79E0C6DCD1D90CF7BC901B06F9598E6464FE32.
- No application migration has been applied.

## Applied result

The approved migration was applied using db push --remote=iwffztmzngpnwpolhzkc --skip-vault --yes. Read-only verification found three RLS-enabled tables, seven policies, 51 states and migration history 20261114000100. Hosted verification created two retained dedicated Auth accounts, tested confirmation denial/password login, persistence, RLS/private streets and session restoration/logout. Actual email delivery and browser/native callbacks remain unverified. No existing users or application rows were deleted.
