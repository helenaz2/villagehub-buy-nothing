# Phase 5 hosted review

Status: expressly approved, migration APPLIED, both AI functions deployed, and
full hosted suite PASSED using three paid calls. Phase 5 is enabled. The OpenAI
key remains only in Supabase Edge Function Secrets.

Target: disposable development project `iwffztmzngpnwpolhzkc`.
Migration: `supabase/migrations/20261114000500_phase5_ai.sql`.
Reviewed SHA-256: `B03BB0E5237A3F662D62D7FBC8778D1315D030B753DC5165E61E64380C88AA1E`.

## Exact database changes

- Create category_proposals with owner-only SELECT, normalized names, validated
  reasons, retry keys, status and references to approved categories.
- Create private ai_requests and ai_daily_usage for server-only reservations,
  input hashes, cached suggestions, bounded retries and usage counters. Images
  are not stored in these tables. Clients cannot write proposals directly, approve
  categories, reserve paid work or finalize AI results.
- Add authenticated create_category_proposal RPC deriving the owner from auth.uid.
  Proposal creation is limited to 10 per user per UTC day. Known categories are
  returned immediately with their canonical name instead of spending an AI call.
- Add two service-role-only reservation/finalization RPCs. Paid-call reservations
  are serialized and limited to 10 per user and 100 globally per UTC day, shared
  by photo and category requests. Failures/retries consume this allowance. A
  request has at most three attempts and a two-minute processing lease; completed
  retries use their cached result. Input changes cannot reuse the same request key.
- Category approval inserts the proposal's server-validated name, not a name
  invented by the model. Case-insensitive uniqueness handles races. New categories
  use sort_order=100, before Other. Add categories to the existing INSERT/UPDATE
  Realtime publication so all signed-in users receive shared catalog updates.

No existing user/listing/message/rating rows or categories are deleted by the
migration. No new Cron job, bucket, Vault secret or paid Supabase resource is added.
Automatic CLI Vault updates remain skipped.

## Two Edge deployments requiring approval

Deploy ONLY `category-review` and `photo-autofill`, with the Docker-free CLI API
bundler. Existing rating-invitations is not redeployed or changed.

Both AI handlers validate the bearer session with Supabase Auth before paid work.
They obtain the real user ID from Auth and apply ownership checks before server
reservations. Gateway verify_jwt is false to support current user-token signing;
the handlers explicitly validate users instead. Anonymous/public-key-only calls
cannot invoke AI. OPENAI_API_KEY and Supabase privileged credentials remain only
in the server environment. Failure logs include only provider HTTP status, not
keys, photos or provider error bodies.

The default provider model is `gpt-6-luna` through the Responses API with
reasoning effort none, strict structured output, store=false, a 45-second timeout
and max_output_tokens=1200. OPENAI_MODEL may override the model on the server;
do not change it during verification without reviewing compatibility and cost.

Category proposals are untrusted input to a fixed review prompt. Refusal,
unavailable billing or provider failures leave proposals pending; the user can
retry from the last ten proposals shown in the category form. No failure defaults
to approval. Final approval and deduplication are database transactions.

Photo requests accept only inline JPEG/PNG/WebP data with a matching signature,
up to 2 MB. No arbitrary image URLs are fetched. The app uses the SDK-compatible
expo-image-manipulator module to resize the cover's longest edge to 1024 and
re-encode JPEG before upload. It sends this copy and the catalog to OpenAI, not
profile/address/chat data. Original listing photos are preserved. The image is
not persisted by the Edge handler or database. OpenAI's applicable API data
policies still apply; store=false is not a promise of zero provider retention.

## Frontend behavior

Existing UI/navigation/logo are preserved. Add Category is enabled in Explore and
the editor after Phase 5 verification. Pending/rejected feedback and retry controls
replace demo auto-approval in real mode. Other stays last on both devices.

Photo autofill asks the user to send the cover photo, then displays title,
description, category, color and tags for review. Apply fills only empty fields.
Condition, dimensions, pickup area and publication stay under the user's control.
Photo/editor errors do not block manual posting. Demo mode remains explicit and
does not call paid AI. Phase 4 features remain enabled while Phase 5 is gated.

## Verification approval scope

`scripts/test-phase5.cjs` uses fake provider/network responses to test authorization
before paid work, private proposals, invalid/oversized image rejection, quota and
cache behavior, safe errors, server-owned identity and output validation.
The worker has its own TypeScript configuration. These are not hosted AI proof.
Lint, app and worker typechecks, and all 27 local tests pass.

The prepared hosted script creates three dedicated test accounts and retains them.
It checks actual RLS, direct-write/RPC denials, global category Realtime delivery,
Other ordering, case-insensitive deduplication, AI rejection, recognition of the
original generated mug fixture, cached retries and concurrent quota enforcement.
Concurrency quota tests use SQL reservations only, without extra provider calls.

Normal success makes THREE paid calls (approve a useful category such as Books,
reject Illegal Weapons, analyze the mug illustration). Requested verification
allowance is at most SIX paid calls total, including any necessary test retries,
each using the stated model, output limit and one small image at most. At current
GPT-6 Luna prices these small tests are expected to cost well below $0.10; this is
an estimate, not a hard dollar cap. Request limits are not billing caps.

Only newly created proposal and AI-request fixtures are deleted after success.
Auth accounts and usage counters remain. One useful AI-approved shared category
is intentionally retained for the app. No existing category, listing, conversation
or rating is deleted. A failed run reports exact fixture IDs for scoped cleanup;
do not repeat paid tests without counting the remaining approved allowance.

Preflight found no schema/function conflicts. CLI dry-run listed only Phase 5 and
its reviewed SHA-256 matched before application. SQL runtime, Edge deployment,
API access/credits, actual provider decisions, shared Realtime and quota tests
passed. The photo test recognized the original generated mug fixture. The
successful same-key retry used the cached result with one ledger attempt.

Books (437bc37a-7046-40c8-b902-9c2eaef635ed) is retained as the useful shared
category. Test account IDs: 1d1b4560-504c-4338-915f-936a942abe5a,
fe36dada-f4c7-4451-aa23-ed71b398c788, bf70d1f9-fc0c-4b52-8f20-0b828825ae6f.
Only test proposal/request fixtures were removed; accounts/counters remain.

EXPO_PUBLIC_BACKEND_PHASE=5 is enabled in ignored .env.local. The owner confirmed
the requested browser photo suggestion, review/apply and category review flow
works. Native photo preprocessing and interactive AI UI remain unverified.
The Expo web/server export completed successfully with Phase 5 enabled; its
ignored output is .expo/phase5-web-check. This is a bundle check, not UI testing.
Local pgTAP remains unrun without Docker. No whole-app/device verification is
claimed from these API/service tests.

Official references: [OpenAI model catalog](https://developers.openai.com/api/docs/models),
[structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs),
[vision](https://developers.openai.com/api/docs/guides/images-vision),
[Expo SDK 58 ImageManipulator](https://docs.expo.dev/versions/v58.0.0/sdk/imagemanipulator/).
