# VillageHub Buy Nothing

Expo SDK 58 / React Native / Expo Router. Supabase is the selected backend.
Frontend, migrations, tests and Edge Functions live in this repository.

## Start

    npm install

Configure an ignored .env.local using .env.example, then:

    npx expo start

EXPO_PUBLIC_DEMO_MODE=false uses real Supabase Auth with no sample records.
EXPO_PUBLIC_DEMO_MODE=true explicitly enables the existing frontend demo.
Changes to environment variables require restarting/reloading Expo.

## Backend status

Phase 1 through Phase 5 migrations were approved and applied to the disposable
development project. Hosted two-account Auth/profile and listing/photo/RLS tests
passed. The owner confirmed email verification and login reached Explore.

Phase 5 is enabled in the existing .env.local: listings, private photos, owner
actions, saved items, search, persistent Realtime messaging and two-way ratings
are connected. The real delayed Cron-to-Edge ratings tests passed.
Three-account messaging/RLS/Realtime tests passed. Browser posting and owner
actions were confirmed by the owner. Two-browser chat and native flows still
need manual verification. Password reset email delivery also remains unverified.
Shared AI-reviewed categories and reviewable photo autofill are connected.
The real AI/category/vision/quota tests passed using three approved paid calls;
Books remains as a useful shared category. The owner confirmed browser photo
suggestions, review/apply and category review work. Native AI interactions still
need manual verification.

The hosted CLI workflow does not require Docker. Local database tests do.

The AI listing recommendation chatbot is deployed and enabled with
EXPO_PUBLIC_RECOMMENDATIONS_ENABLED=true in the existing .env.local. Hosted
search/auth/conversation tests passed using four approved paid AI calls. The
Explore entry point opens real listing recommendations and existing detail pages.
The owner confirmed browser conversation and listing links work. Native chatbot
interaction still needs manual verification. See
docs/RECOMMENDATION_CHATBOT_REVIEW.md.

Read [the status and setup guide](docs/BACKEND_STATUS.md) before live testing.
It includes exact dashboard redirect URLs, local setup and remaining phases.

## Checks

    npm run lint
    npm run typecheck
    npm run test:phase1

Local Supabase database tests (requires running Docker/Podman):

    npm run db:start
    npm run db:reset:local
    npm run db:test

The reset command is only for a disposable local database. Never reset a hosted
project. Two-account integration tests: npm run test:auth:local, with LOCAL
server-only test keys as described in docs/BACKEND_STATUS.md.

## Layout

- src/app: Expo Router screens
- src/components: existing mobile UI
- src/data: explicit demo adapter, live adapter and auth context
- src/lib/supabase.ts: client-only persistent Supabase client
- src/services: Auth, public profile and private address access
- supabase/migrations: version-controlled schema and policies
- supabase/tests/database: two-user authorization tests
- supabase/functions: future server-side functions

Never put service-role keys, database passwords, or AI keys in EXPO_PUBLIC_ vars.
