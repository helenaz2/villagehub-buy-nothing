# Known limitations and next steps

What was checked: strict TypeScript for the app and scripts, a production web build, and click-through runs of the whole demo path in a headless phone-sized browser (light and dark mode, no console errors). The SQL migration and seed were loaded into an in-memory Postgres, with stand-ins for PostGIS and Supabase's built-in schemas.

## Not yet run for real

- **Not tried on a phone.** Camera capture, the blur and light pre-check on real photos, haptics, accelerometer auto-capture, the native map and notifications have only been type-checked. Run it in Expo Go before the demo.
- **The edge function has never been called.** `scan-item` has not been deployed or run against the Anthropic API. Confirm the model id in `ANTHROPIC_MODEL` and try a few real photos.
- **Supabase sync is untested.** The migration, row-level security, triggers and `src/data/remote.ts` were written together and type-checked, but never run against a live project. PostGIS functions were not exercised.
- **Seed photos were not checked by eye.** They load from Unsplash by photo id. Open the app once and make sure each photo matches its listing, especially the six sample items.

## Partly built

- **Payments.** The claim sheet explains the hold and the handoff screen offers a tip, but nothing calls Stripe. Next: a `create-hold` edge function that creates a manual-capture PaymentIntent on a Connect account, and capture inside `complete_handoff`.
- **Multi-item detection.** The scanner draws a tappable box for each item and creates one listing per pick, but only when the live model returns several items. The canned results are single items, so this can't be shown offline. Next: add a multi-item room sample.
- **Synced mode.** Listings, claims, confirmations, messages and handoffs write through to Supabase, and chat subscribes to Realtime. The claim queue and pickup-time changes don't subscribe yet, and the demo neighbor turns itself off in synced mode.
- **Location.** Distances are measured from the region center set in `.env`, not the phone's GPS. Next: use `expo-location` (already installed) with the region as the fallback.
- **Donation places.** Twelve hand-checked Berkeley and Oakland entries, each with its source and check date. Several have no confirmed hours, and the app says so. There are no live Google Places or OpenStreetMap queries yet. Rules change, so the app tells people to call ahead.
- **Trust.** Verified badges come from the profile. There's no phone or .edu verification flow, report and block only show a confirmation, ratings are saved but not averaged into a profile, and the photo moderation column exists without a moderation step.
- **Wanted board.** Posts are saved, but nothing matches them to new listings or sends a notification.
- **Pickup times.** Suggestions follow simple daylight rules, not either person's calendar. "Add to calendar" opens a pre-filled Google Calendar event.
- **Map.** Native only. The web build shows a note instead.

## Next steps, in order

1. Run the full demo in Expo Go on a real phone and fix what breaks.
2. Deploy `scan-item` and test 20 to 30 real photos, then tune the prompt in `supabase/functions/scan-item/prompts/`.
3. Bring up a Supabase project and run two phones against it.
4. Use the phone's location for distance and the feed.
5. Stripe Connect test-mode holds and capture.
6. Wanted-board matching with push notifications.
7. Live places from Google Places and Overpass, merged with the curated table and cached.
