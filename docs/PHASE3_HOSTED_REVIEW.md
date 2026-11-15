# Phase 3 hosted review

Status: approved, APPLIED and hosted tests passed. Phase 3 enabled. Phase 2 browser
posting and owner actions were confirmed by the owner.

Target: disposable development project `iwffztmzngpnwpolhzkc`.
Migration: `supabase/migrations/20261114000300_phase3_messaging.sql`.
Reviewed SHA-256: `3A921B2FD468E94ACF700BE1E084740CD47D372B65EE453E73797727B5DE5C51`.

## Exact database changes

- Create `conversations`, `conversation_members`, and immutable `messages` tables,
  ownership/participant constraints, server identifiers/timestamps and indexes.
- Enable RLS on all three tables. Only the two participants can read a thread or
  its messages. Each user can read/update only their own Inbox preferences.
- Add four restricted functions: participant lookup, opening a thread from a
  published listing, sending messages, and marking an observed sequence read.
- Message writes use an atomic RPC with participant validation, serialized
  sequence allocation, retry deduplication and a 4,000-character limit. Clients
  cannot forge senders, timestamps, previews or read sequence numbers.
- Add the three tables to the existing `supabase_realtime` publication. Subscriber
  SELECT policies enforce participant-level access. Preference rows remain private.
- Record this migration in Supabase migration history. Vault updates are skipped.

No existing rows, accounts, tables or buckets are deleted or replaced. Deleting a
listing retains its conversation with a title snapshot. Deleting an Inbox entry
hides it only for that user; a new message restores it. This is not permanent
message erasure. No paid resource, Edge Function deployment or Cron job is added.

## Frontend

The existing Message host button, Inbox rows, swipe actions and chat screen use
the real service when `EXPO_PUBLIC_BACKEND_PHASE=3`. Messages have pagination;
Inbox has incremental loading. Sessions unsubscribe on account change, refresh
after reconnect, and show a disconnected notice with manual refresh. Chat keeps
unsent text and a retry key on failure. Read state waits for the observed latest
message to load. Real chats have no simulated replies or demo rating invitation.
Ratings remain Phase 4. No UI styling/navigation/logo redesign is included.

## Verification and approval scope

`scripts/test-phase3.cjs` tests service contracts without hosted writes.
`scripts/verify-phase3-hosted.cjs` was executed with explicit approval.
It creates three dedicated real test accounts (two participants plus an outsider)
and retains those accounts. It creates one listing/photo/conversation fixture,
checks two-way messages, retry idempotence, read races, private preferences,
hidden-thread restore, pagination, server validation, participant RLS, actual
Realtime delivery and outsider Realtime denial. It deletes only that run's own
conversation/messages/listing/photo fixtures, identified by exact IDs and owners.
The test helper obtains an admin key in memory only; Expo never receives it.

Read-only preflight found no table/function conflicts and confirmed the Realtime
publication exists. Lint, typecheck and all 16 service-contract tests passed.
Only the reviewed migration was applied. Hosted tests passed, including actual
Inbox subscription events and conversations surviving listing deletion.
Manual two-browser interaction remains unverified. Local pgTAP tests
remain unavailable without Docker; Docker is not required for hosted checks.

Phase 3 is enabled in ignored `.env.local`. Restart Expo and
verify a conversation between two browser accounts before continuing to Phase 4.

The initial test timed out on Realtime delivery. Supabase documents a gap between
socket SUBSCRIBED and PostgreSQL listener readiness. The app and test now wait for
the listener system confirmation; a service regression test covers that sequence.
Full hosted tests then passed. Only exact test fixtures were removed, including
the initial failed-run fixture; all Auth accounts were retained.
