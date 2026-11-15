# Profile photos — proposed hosted change

Applied and hosted-tested on 2026-11-14 after the owner requested activation. Target is the confirmed disposable development
project `iwffztmzngpnwpolhzkc`.

- Applied `20261114000800_profile_photos.sql`, skipping Vault updates. Initial hosted testing caught the missing Phase 1 column-level update permission; `20261114000900_profile_photo_update_grant.sql` grants UPDATE only on `avatar_path`, with existing RLS and guards unchanged. The rerun passed all checks below.
- Add nullable `profiles.avatar_path`, an ownership/path constraint and a trigger
  requiring the object to exist before it can be referenced.
- Create a private `profile-photos` Storage bucket, with a 2 MB limit and JPEG,
  PNG and WebP only. Owners upload to their own UUID prefix. Authenticated neighbors
  can obtain signed URLs for current profile photos; unreferenced photos stay
  owner-only. Anonymous access, foreign uploads/deletes and overwriting objects are
  unavailable. Referenced photos must be detached before deletion. Existing system
  profile protections remain in force.
- No existing data is deleted. No Edge Functions, jobs, AI calls or new paid
  resources. Ordinary Supabase storage/bandwidth usage applies.
- Run `scripts/verify-profile-photos-hosted.cjs` using two newly created, retained
  test accounts and the existing app-owned fixture image. Check own upload,
  cross-user edit/upload/delete denial, private unpublished objects, signed neighbor
  viewing, anonymous denial, missing/foreign paths, referenced-object protection,
  and size/MIME limits. Clear only those accounts' photo references and delete only
  their exact uploaded fixture paths afterward.
- After tests pass, enable `EXPO_PUBLIC_PROFILE_PHOTOS_ENABLED=true` in ignored
  `.env.local`. Restart Expo. No deployment is needed for these frontend edits.

The editor already selects a photo, previews it and prepares a small JPEG using
installed Expo modules. Profile photo saving is now enabled in ignored `.env.local`.
Two-account hosted upload/read/permission tests passed; their photo references and
files were removed. Test accounts were retained, including the initial failed run.
Actual device picker interaction remains unverified. Signed URLs expire after one hour; reopening/refetching a profile
obtains a fresh URL. Account deletion/long-term orphan cleanup is outside this change.
