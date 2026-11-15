# Supabase backend status

All backend code remains in this repository. The hosted project
`iwffztmzngpnwpolhzkc` was confirmed by the owner as disposable development.
No paid Supabase resource was created. Seven approved OpenAI verification calls
were made: three for Phase 5 and four for recommendations. Docker is not needed
for this hosted CLI workflow.

## Phase 1

Migration `20261114000100_phase1_profiles.sql` was approved and applied.
Hosted two-account tests passed for authentication, verification enforcement,
profile persistence, private streets, cross-user authorization and session reuse.
The owner confirmed that the actual email confirmation link and login reached
Explore. Dashboard redirect URLs for localhost ports 8081 and 8084 were saved.

The app uses persistent Supabase Auth sessions, PKCE callback routes, email and
password login, profile editing, and owner-only street storage. Seed data is
available only with `EXPO_PUBLIC_DEMO_MODE=true`.

Password reset email delivery and native device flows remain manually unverified.
The twelve mocked service-contract tests pass; they supplement hosted tests.

## Phase 2

Migration `20261114000200_phase2_listings.sql` was approved and applied.
The full hosted two-account fixture suite passed: private photo uploads and signed
reads, publication, ordered photo edits, cross-user write denial, saved-item
isolation, search, pagination requests, claim/relist, persistence, deletion and
Storage cleanup. Test accounts were retained. Only test listing/photo fixtures
were removed, including the exact fixture left by an initial failed cache check.

The existing UI is connected for these features. The ignored `.env.local` now
sets `EXPO_PUBLIC_BACKEND_PHASE=5` and `EXPO_PUBLIC_DEMO_MODE=false` after Phase 5 verification.
Restart Expo after environment changes:

    npx expo start --web --port 8084

The owner confirmed browser posting and owner actions work after the requested
manual check. Native photo selection/upload remains unverified.
Service-level tests do not prove browser or device interactions.

See [Phase 2 review](PHASE2_HOSTED_REVIEW.md) for schema and verification details.

## Phase 3

Migration `20261114000300_phase3_messaging.sql` was approved and applied with
Vault skipped. Hosted three-account tests passed for two-way persistent messages,
retry deduplication, participant RLS, actual Realtime delivery, outsider Realtime
denial, per-user preferences, read-state races, pagination and server validation.
The app's exact Inbox subscription received actual events. Conversations retained
their title and participants after their fixture listing was deleted.

The initial test timed out because socket subscription preceded backend listener
readiness. App and tests now wait for the PostgreSQL listener system confirmation;
a regression test covers this. Full hosted tests passed after the fix. Only exact
test fixtures were deleted, including the initial failed fixture. Accounts remain.

Phase 3 is enabled. The owner deferred the two-browser check because no other
person is using the app. The check can use two accounts controlled by one person;
manual browser and native messaging verification remain pending. Automated real
multi-account tests passed. See [Phase 3 review](PHASE3_HOSTED_REVIEW.md).

## Phase 4

Phase 4 migration and Edge worker were explicitly approved, applied and deployed.
RLS, restricted worker execution and the active Cron job were verified read-only.
The owner configured worker secrets and the complete hosted delayed-rating suite
passed, including the real five-minute wait, Cron-to-Edge delivery, two-way
immutable ratings, aggregate scores, permissions, dismissals and resumption
revocation. Only exact test fixtures were deleted; test accounts remain.
Phase 4 is enabled. Browser/native rating UI remains manually unverified.
See PHASE4_HOSTED_REVIEW.md for approval scope and verification details.

## Phase 5

Migration `20261114000500_phase5_ai.sql` and only the category-review/photo-autofill
Edge Functions were approved, applied and deployed. The full hosted three-account
test passed with three paid AI calls, within the approved six-call allowance.
It verified real approval/rejection, cross-account catalog Realtime delivery,
Other last, deduplication, private proposals, authorization, mug image recognition,
cached retries without another call, concurrent quotas and input validation.

Books remains as the useful AI-approved shared category. Only new proposal and
AI-request fixtures were deleted. Test accounts and usage counters remain. The
OpenAI key stays in server secrets. No existing app data was deleted.

Phase 5 is enabled. The owner confirmed the requested browser AI flow works:
photo suggestions, review/apply and category review. Native preprocessing and AI
interactions remain unverified. See PHASE5_HOSTED_REVIEW.md. Existing demo behavior remains
available only through explicit demo mode. Further hosted changes/deployments
still require approval; no production database changes are authorized.

## Checks

The listing recommendation chatbot migration and function were explicitly approved,
applied and deployed. Its real two-account suite passed using four paid AI calls,
including search/material/location accuracy, actual follow-ups, private auth,
claimed/deleted/draft exclusion, signed photos, cache requery and burst throttling.
Only its own seven listing/photo and AI-request fixtures were deleted. Accounts
and counters remain. EXPO_PUBLIC_RECOMMENDATIONS_ENABLED=true is now enabled.
The owner confirmed browser conversation, follow-ups and listing links work.
Native chatbot UI remains manually unverified.
See RECOMMENDATION_CHATBOT_REVIEW.md for approval scope and verification details.

    npm run test:phase1
    npm run test:phase3
    npm run test:phase4
    npm run test:phase5
    npm run test:recommendations
    npm run typecheck:functions
    npx expo lint
    npx tsc --noEmit

Lint, app/worker typechecks and all 38 local tests pass. Hosted tests require the logged-in Supabase CLI and the explicit
approved-development-project argument. The helper obtains a privileged test key
in memory only; it is never stored in the Expo app. Do not print or paste keys.

Local pgTAP tests are prepared but unrun because Docker/Podman is absent. These
optional local commands require a running local container runtime:

    npm run db:start
    npm run db:test

`npm run db:reset:local` is destructive to the local database. Never use a hosted
reset. The hosted migrations and hosted authorization tests were executed without
installing Docker.

## Configuration

Signup email codes: app code-entry, resend and verification are implemented.
Seventeen local Auth tests, lint/typecheck and the web export pass. Hosted signup
email template still needs the owner to add `{{ .Token }}` (see
`docs/EMAIL_CONFIRMATION_CODES.md`). Email confirmation remains enabled. No hosted
Auth configuration was changed and no real signup emails were sent by tests.
Email delivery and Expo Go confirmation/session restoration await manual testing.

Copy `.env.example` to ignored `.env.local` for a new checkout. Use the project's
public URL and publishable key with `EXPO_PUBLIC_` names. Never put service-role
keys, database passwords or AI API keys in Expo variables. The phase flag selects
frontend integrations; database RLS enforces authorization.

In Supabase Authentication > URL Configuration, allow these development routes:

- http://localhost:8081/auth/callback
- http://localhost:8081/reset-password
- http://localhost:8084/auth/callback
- http://localhost:8084/reset-password

PKCE email links should open in the same browser/device that requested them.
Different-device confirmation may require logging in afterward. Native redirects
must be configured separately before native email-link testing.

The Supabase free tier is preferred; no paid Supabase resource was created. AI is
enabled with the owner's server-only key and seven approved verification calls
were made. Higher storage/database usage and production email delivery may add
costs later. Server AI quotas limit requests, not a guaranteed dollar spend.

## External discovery foundation (Phase A verified)

Inbox assistant UI: a permanent VillageHub Buy Nothing conversation with the logo
opens the listing assistant. Explore and Inbox share search turns and draft text
in memory for the current account/session; switching accounts resets them. Search
history is not persisted across app restarts. Approved/rejected category notices
are rendered from the owner's existing RLS-protected proposal records (latest 50),
refreshing after local review, navigation and every 30 seconds. They use no AI
calls and need no migration/deployment. This is a feed of current category
decisions, not a general-purpose durable notification/event history. New browser
interaction and cross-session notice presentation still require manual UI checks.

Profile photos: migrations 008 and 009 are applied. The first hosted test exposed
a missing avatar column update grant; the narrow follow-up fixed it. The rerun
passed owner upload/edit, signed neighbor viewing, anonymous/foreign access denial,
path validation, referenced-object deletion protection, and size/MIME limits.
Fixture photos and references were cleaned up; test accounts remain. Local photo
saving is enabled. Restart Expo to load the flag; device picker UI still needs
manual verification. No AI calls or new paid resources were used.

Phase A code and review are in docs/EXTERNAL_FOUNDATION_REVIEW.md. With explicit approval, migration 007 was applied (Vault skipped), only external-submit was deployed, and the official banned identity was created on 2026-11-14. The hosted two-account suite and transactional official-identity SQL guard test passed. Exact receipt/candidate/listing/photo fixtures and temporary reviewer access were removed; the official identity, two test accounts and completed run audits remain. User selected private URL submission because no authorized feed exists. No marketplace access, scheduled collection or paid AI usage occurred. All 46 local tests pass. Phases B-E, the submission UI and real external item verification remain pending.
