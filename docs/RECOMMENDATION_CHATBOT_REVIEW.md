# AI listing recommendation chatbot review

Status: explicitly approved, migration APPLIED, Edge Function deployed, and
hosted suite PASSED using four paid AI calls within the six-call allowance.
The recommendation flag is enabled in ignored .env.local. Phase 5 remains enabled.
Target: the same disposable development project `iwffztmzngpnwpolhzkc`.

## Implementation

Explore gains an Ask VillageHub entry point, opening the protected
`/recommendations` Expo Router screen. It uses the existing Screen, buttons,
palette and item detail route. Other screens and navigation structure remain.
The feature gate EXPO_PUBLIC_RECOMMENDATIONS_ENABLED=true is now enabled after
hosted verification. Demo mode cannot call this assistant or return demo items.

The model interprets recent user messages and the previous validated search plan
into item synonyms, required attributes and location filters. It never receives
listing rows and cannot provide listing IDs, links, recommendation text or counts.
The reply text is a server template; cards come only from actual database rows.
Invalid/refused/incomplete model output produces a retryable error rather than
invented results or an unconstrained search.

Up to six turns are held in memory, scoped to the current signed-in user, cleared
on account change and Start new search. Each request sends at most eight recent
messages (the UI sends at most six), at most 500 characters each and 3,000 total,
plus a bounded previous plan. Messages are not persisted as chatbot transcripts.
The existing private AI ledger caches the validated plan and an input hash.

Each search, including a cached retry, queries live listings again. Only available
rows with a cover photo record are returned, up to eight. Deleted rows, drafts
and claimed rows are excluded. Cards show real title, signed photo, city,
neighborhood and availability, and open the existing detail page. Opening a card
rechecks availability. Latest results can be refreshed without paid AI, and are
rechecked on return from detail. Results are snapshots, not continuous realtime
availability subscriptions. A missing photo has a visible fallback.

Explicit city/neighborhood filters use case-insensitive exact stored text. If no
explicit place is requested, the server prefers the profile city and can return
other cities afterward. Profiles currently have no neighborhood field; none is
fabricated from the private street. Explicit conversational neighborhoods are
supported. No distances, geocoding, coordinates or vector database are introduced.

Loading, empty, clarification, error and same-request retry states are included.
Current constraints: English full-text matching, a small synonym plan, exact city
names, eight results, and no semantic/vector similarity or radius calculation.
The UI explains recent messages go to OpenAI and availability can change.

## Why a migration is necessary

File: `supabase/migrations/20261114000600_recommendations.sql`.
Reviewed SHA-256: `3AB9152681EFBB7C953EFD133F5D6970A12CBF4196B65309CAD913F8B194E9EE`.

The existing AI quota kind constraint/function allow only category and photo.
The migration replaces that check constraint and extends reserve_ai_request to
add recommendation, preserving existing authorization, leases and daily quotas.
All AI features share 10 paid reservations per user and 100 globally per UTC day,
including failed/retried provider attempts. Successful plan retries use the cache.
Recommendation requests also have a 20-per-user-per-UTC-minute limit, including
cached retries, recorded in the existing private usage table. No new table is added.

The new authenticated, SECURITY INVOKER search_listing_recommendations RPC uses
the existing GIN-indexed search_document for item synonyms, then narrows those
matches using material/fabric/color/features and search text for attributes.
Each synonym group is OR, required groups are AND, and all terms are parameterized
phraseto_tsquery inputs. Explicit locations filter; profile city affects ranking.
The RPC honors RLS and always filters status=available. Anonymous execution is
revoked. No service key is used to bypass listing reads.

No listing schema, existing rows, search-document backfill, timestamps, indexes,
Storage policies, Cron jobs, Vault secrets or Realtime publications are changed.
No existing data is deleted by the migration. No separate backend repository,
search engine or paid Supabase resource is created.

## Edge Function and shared code

Deploy only `listing-recommendations` using the Docker-free API bundler. It reuses
the existing user-token validation, bounded JSON reader, structured OpenAI request
helper, quota/lease ledger, and server secrets. Shared helper extraction retains
the category/photo behavior and is covered by their existing regression tests.
The existing frontend AI invocation/error adapter and listing detail service are
also reused. No dependency was added for the chatbot.

JWT gateway verification is disabled for compatibility with current signing keys,
but the handler verifies the bearer session with Supabase Auth before reserving
work. Searches and signed-photo requests use that user's RLS credentials. Only
quota/finalization calls use the service key. Secrets never enter the Expo bundle.
OpenAI uses the existing server key/model (default GPT-6 Luna), store=false,
reasoning none, strict search-plan JSON and at most 600 output tokens per call.
Only bounded user text and prior search filters go to OpenAI, never private
streets, Inbox messages, user passwords, listing images or database inventory.

## Verification and approval scope

`npm run test:recommendations` covers authorization before work, input limits,
explicit location filters, passing refinement/new-item context, profile city
priority, invalid model JSON/IDs, empty/claimed results, live requery on cached
retry, quotas and unsafe frontend recommendation payloads. Mocked network tests
do not prove SQL correctness or actual model interpretation.
Lint, app/Edge typechecks and all 38 local tests pass. The web/server export also
passes with the recommendation flag enabled. These checks supplement, rather
than replace, the subsequently executed real-account hosted suite.

`scripts/verify-recommendations-hosted.cjs` was run with approval and PASSED. It creates two
dedicated accounts (retained) and seven exact listing/photo fixtures. It marks
one claimed, changes one back to draft while retaining its photo, and deletes one
before testing. It checks indexed search, materials-only matching, location
ranking, explicit city, anonymous denial, invalid input and exclusion of deleted,
claimed and own-draft rows. Four normal paid turns test desk/Berkeley, wooden
refinement, switching to chairs and baby clothes near the profile city. Cards
are checked against database rows and actual signed photos. A cached request is
repeated after claiming a result to prove it cannot reuse stale availability.
SQL-only reservations test burst throttling of cached requests without paid AI.

Proposed approval allowance: at most SIX paid calls total including necessary
test retries, each at most 600 output tokens, using GPT-6 Luna. Normal success
uses four calls. Estimated cost is well below $0.10 at current model prices,
not a hard dollar spending cap. No image input is sent to the model for this test.
Only that run's own listing/photo/AI-request fixtures are deleted. Accounts and
usage counters remain. No unrelated listing, message, profile or category is removed.

Read-only preflight confirmed the GIN/feed indexes and current profile fields,
and found no existing search RPC conflict. CLI dry-run lists only migration 006.
The SQL runtime, hosted RLS/search execution, deployment and real provider
follow-ups passed. The suite also verified cached-request throttling and actual
signed-photo downloads. The owner confirmed the requested browser conversation,
follow-up and listing-link flow works. Native UI remains manually unverified.
Local pgTAP would require Docker, which is not installed.
Hosted checks did not require Docker.

Only the reviewed migration and listing-recommendations deployment were performed.
All seven exact test listing/photo fixtures and owned AI-request fixtures were
removed; Auth accounts and usage counters remain. Retained test account IDs:
d2d9dd3f-0d3d-4f04-b227-44ac92809e6b and e199b2d0-84f4-422f-b247-5134e07ae0bd.
No unrelated app data was deleted. Further deployments/paid tests outside the
approved allowance still need approval. Production changes are not authorized.
