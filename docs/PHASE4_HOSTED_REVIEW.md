# Phase 4 hosted review

Status: explicitly approved, migration APPLIED and worker deployed with the
Docker-free API bundler. The owner saved worker secrets; hosted tests PASSED.
Phase 4 is enabled. Automated multi-account messaging tests
passed; the owner deferred browser testing until later.

Target: confirmed disposable development project `iwffztmzngpnwpolhzkc`.
Migration: `supabase/migrations/20261114000400_phase4_ratings.sql`.
Reviewed SHA-256: `B823CBEB00C558FF9D448E414882D2E4659000830A30E1E6A9B561532BE206CE`.

## Behavior

Conversation completion is inferred from inactivity: after BOTH participants send
a message, an invitation is eligible only after five minutes without a new
message. Cron runs once a minute, so delivery may be later than five minutes.
Invitations are inline assistant messages in chat. No blocking overlay is added.
A new message restarts the wait and revokes unsubmitted invitations immediately.
An already submitted rating stays immutable. Each participant rates the other
once per conversation, independently. Aggregate host ratings come from the server.

## Database changes requiring approval

- Create rating_jobs, private per-user rating_invitations and immutable ratings.
  Enable RLS; clients cannot create jobs/invitations or write rating rows directly.
- Add a message trigger to enqueue/reschedule jobs and revoke stale invitations.
  Backfill pending jobs for existing nonempty conversations without editing messages.
- Add restricted worker processing, submit/dismiss and aggregate-stat RPCs.
  Submission checks membership, server time and the current message sequence.
- Add invitation/rating tables to Realtime. Change the application's existing
  publication to INSERT/UPDATE only because DELETE events cannot enforce SELECT
  RLS. The migration refuses this change if unrelated tables are present. Inbox
  deletion uses per-user hiding and remains an UPDATE. No client feature depends
  on physical deletion events.
- Install pg_cron and pg_net, create a restricted invocation function and a named
  once-per-minute Cron job. The invocation function reads only the two named
  worker secrets from Vault and does nothing when they or due jobs are absent.
- Supabase migration history records this migration. Automatic CLI Vault updates
  remain skipped; the dedicated secrets are configured separately by the owner.

No existing tables, listings, accounts or messages are dropped/deleted by the
migration. Background processing can create invitations for existing eligible
development conversations; it never fabricates a submitted rating.

## Edge deployment requiring approval

Deploy ONLY `supabase/functions/rating-invitations` to this project, using the CLI
API bundler without Docker. The worker validates a new server-only invocation
key, then runs the service-role-only processing RPC. Client credentials cannot
run it. Secrets remain in Edge environment and Vault, not the application.
Follow PHASE4_WORKER_SETUP.md to configure two Vault entries and one Edge secret.
No paid resource or AI provider is added. Calls count toward existing usage limits.

## Tests and remaining checks

The local tests cover stale invitation suppression, worker authentication and
sanitized failures. App and worker have separate TypeScript checks.
Lint, both TypeScript checks and all 19 local service/worker tests passed.

The prepared `scripts/verify-phase4-hosted.cjs` requires approval to create three
dedicated test accounts and two exact listing/photo/conversation fixtures. It
retains accounts and deletes only that run's conversation/message/rating/job/
invitation/listing/photo fixtures. It tests early rejection, rescheduling,
actual five-minute wait and Cron-to-Edge delivery, two-way submissions, idempotence,
aggregate scores, private dismissals, outsider denial and post-invitation revocation.
It does not shorten the delay or modify server clocks. It may invoke the worker
RPC to confirm early processing cannot deliver invitations; the real delayed
delivery must occur through Cron and Edge. The first run stopped at an incorrect
test assertion expecting empty private-job rows; column/table grants correctly
denied the query instead. The assertion now accepts that explicit permission
denial. Its exact fixtures were cleaned up and accounts retained. A fresh run is
completed the real delay and passed the full suite. Cron-to-Edge delivery, both
participants' immutable ratings, aggregate scores, private dismissals, server-only
worker access, rescheduling and resumed-conversation revocation were verified.
Only the test's exact fixtures were deleted; accounts remain.

Read-only preflight found no name conflicts. The fresh dry-run listed only the
approved migration; its SHA-256 matched the review. pg_cron and pg_net are now
installed. Read-only verification confirmed RLS on all three rating tables, the
active minute job, INSERT/UPDATE-only publication, and worker RPC execution denied
to authenticated users but granted to service_role. After the owner's setup,
read-only checks confirmed both dedicated Vault entries exist without reading
their values. The test confirmed that a public key alone gets HTTP 401 from the
configured worker. The full test subsequently verified scheduled delivery after
the real five-minute idle window and scheduler tick, without changing clocks.

Earlier CLI help requests hit automatic approval-review deadlines. After explicit
Phase 4 approval, deployment flags were verified successfully and the approved
deployment completed. Local pgTAP remains unavailable without Docker.

The full Phase 3 hosted messaging/RLS/Realtime regression suite passed after the
publication change. Only its own exact fixtures were removed; accounts remain.

After approved migration, deployment, configuration and passing hosted tests,
EXPO_PUBLIC_BACKEND_PHASE is now 4. Browser/native rating UI remains a
separate manual check and will not be claimed as verified by API tests.
