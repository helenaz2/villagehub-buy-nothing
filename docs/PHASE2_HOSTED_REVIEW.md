# Phase 2 hosted review

Status: approved and applied to disposable project iwffztmzngpnwpolhzkc. Hosted service/RLS/Storage tests passed. Native and browser posting UI still need manual verification.

Migration: supabase/migrations/20261114000200_phase2_listings.sql.

Creates categories (four initial rows, Other last), listings with server UUIDs/timestamps and validation/search, ordered listing_photos, and private per-user saved_items. Adds RLS/ownership rules, feed/search indexes, a validation trigger and a security-definer atomic publication RPC that checks auth.uid(), ownership and uploaded object paths. Creates a private listing-photos Storage bucket limited to 10 MB per photo and JPEG/PNG/WebP/HEIC MIME types.

No existing rows, accounts, tables or buckets are dropped/deleted by applying the migration. SQL inside the publication function replaces only the invoking owner's photo metadata when they explicitly edit their post. Photo files currently referenced by a post cannot be deleted directly.

The existing posting/gallery/profile/saved UI is wired to services behind EXPO_PUBLIC_BACKEND_PHASE=2, now enabled in .env.local after approval and passing hosted tests. It supports private uploads and signed reads, cover ordering, atomic publication/details edits, saved items, owner controls, server search and pagination. Native file reads use the SDK-compatible expo-file-system package.

Verification script: scripts/verify-phase2-hosted.cjs. It obtains a server test key through the logged-in CLI in memory only, creates two dedicated confirmed Auth test accounts, and uses ordinary user sessions for CRUD/storage/RLS tests. It uploads tiny PNG fixtures, tests edits/cover order/save isolation/search/claim/relist, then deletes ONLY its own listing/photo fixtures to verify deletion and cleanup. Test Auth accounts are retained. No unrelated listing, object, account or private data is deleted. Running these fixture deletions requires the approval requested together with this review.

Verified through hosted tests: the SQL migration, Storage policies, real upload/publication/search/delete operations. Native photo selection/upload UI and browser interaction still require device/browser testing; service/API success is not UI verification.

Messaging remains disabled for real posts until Phase 3. Category AI approval remains a Phase 5 feature.

## Verification outcome

The first run failed a deletion check because a previously downloaded object was cached; a read-only query confirmed it was removed. The test now checks authoritative Storage listing and fresh signed-URL creation. The subsequent full run passed. It created two dedicated Auth accounts, retained them, and removed only its own listing/photo fixture. The exact leftover fixture from the earlier failed run is cleaned up separately under the same approved fixture scope. EXPO_PUBLIC_BACKEND_PHASE=2 is enabled in ignored .env.local. Browser email confirmation-to-Explore flow was confirmed by the owner.
