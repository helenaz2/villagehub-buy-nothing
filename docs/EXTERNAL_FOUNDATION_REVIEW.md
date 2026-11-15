# External discovery — Phase A hosted review

Applied, deployed and hosted-tested on 2026-11-14 after explicit approval. Project:
`iwffztmzngpnwpolhzkc`, confirmed disposable development project.

## Exact proposed changes

- Apply only `supabase/migrations/20261114000700_external_foundation.sql`, skipping Vault updates. SHA256: `9BCA70F44B2F26E215DB774767A3050153185E50C6444B31BC80FCCD4667D3C5`.
- Deploy only the `external-submit` Edge Function. It verifies the user's session, validates a source-specific URL and original notes, and submits through a service-only database RPC. It never fetches a marketplace or calls AI.
- Run `scripts/setup-external-system-identity.cjs` to reserve a one-time official UUID, create the banned/noninteractive Auth identity and canonical `villagehub-buy-nothing` profile. Its random password is discarded. No email is sent and no normal reviewer is appointed.
- Create **no scheduled jobs**, subscriptions or paid resources. Make **zero AI calls and zero marketplace requests**. Existing Supabase database/function/storage usage applies; no separate API cost is expected.

The migration adds eight tables: `external_system_identity`, `external_reviewers`,
`external_sources`, `external_discovery_runs`, `external_listing_candidates`,
`external_link_submissions`, `external_listing_reviews`, `external_listing_links`.
It adds RLS, service-only intake/identity RPCs, canonical deduplication, ten new
submissions per user per UTC day, reviewer read permissions and source configuration.
All four source adapters have automated collection and republication disabled.
Facebook Marketplace, Craigslist and Freecycle accept private URL reports only;
Buy Nothing is unavailable. Configurable initial coverage is the Bay Area.

It extends the profile username constraint for the exact reserved hyphenated
identity, rejects conflicting reserved aliases (preflight found none), and adds
profile/listing guards against authenticated system-account management. A
conversation trigger prevents messaging the system as the original seller.
A restrictive listing SELECT policy hides system posts unless publication,
permissions, explicit free-offer evidence, human approval and supported availability
verification all pass. Verification expires within twelve hours at read time.
Ordinary native listing policies remain in force. No existing records are deleted
or renamed. Setup retains the official account; it cannot silently rebind its UUID.

## Verification covered by approval

1. Repeat the read-only preflight and CLI migration dry-run; stop on unexpected drift.
2. Apply the single migration and deploy the single function; bootstrap the identity.
3. Run `scripts/verify-external-foundation-hosted.cjs` with the explicit approved project argument. Create two retained test accounts; temporarily grant one fixture reviewer role and remove it afterward. Test authorization, impersonation prevention, native draft editing, receipt isolation, canonical deduplication, reviewer boundaries, invalid URLs, hidden system posts, chatbot exclusion and messaging/publication rejection.
4. Fixtures use fake marketplace URLs, original test notes and an app-owned image. Delete only the run's exact receipts, candidates, private native draft, hidden system listing and photo. Retain Auth accounts and completed run audit rows. No real external offer is published.
5. Run `supabase/tests/external_system_guard.sql` in a transaction that sets authenticated claims for the banned official UUID, checks profile/listing denial, and rolls back. This tests database guards without signing in as the system account.

Local classifier/handler tests use mocks. The approved hosted two-account suite
passed, including fixture cleanup and removal of temporary reviewer access. The
transactional official-identity SQL guard test also passed and rolled back. The
official identity is banned from interactive login. These checks used fake URLs,
not real marketplace discovery. Local container-based pgTAP remains unavailable
without Docker; the hosted tests do not require Docker.

## Remaining phases and limitations

- **B:** Add the authenticated mobile-friendly URL submission screen and receipt states. This is the selected discovery method; no authorized feed exists. User reports never prove availability or grant reuse rights.
- **C:** Add evidence-bound server AI drafts using approved categories, validation, quotas and request logging. Separate approval is required for deployment and paid tests.
- **D:** Add designated-admin review, permission/free-offer evidence and publishing. Adapt native required fields for unknown external facts, neutral image/provenance presentation, original-source links and no-host messaging. The foundation deliberately exposes no publisher.
- **E:** Integrate Explore/chatbot provenance, stale handling and monitoring. Schedule collection only for a subsequently authorized connector with a supported verification method. No marketplace polling can be enabled by this foundation.

The existing UI is preserved. This phase is not a complete external discovery
feature. No real external item has been discovered, processed or displayed.
See [source permission audit](EXTERNAL_SOURCE_PERMISSIONS.md).
