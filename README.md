# Curbside

Point your camera at something you no longer need. Curbside recognizes it, writes the listing, and publishes it for neighbors in a few taps. If it isn't worth passing on, Curbside finds the nearby place that will do the most good with it.

"Curbside" is a working name. It appears in the UI strings and `app.json`.

## Run it

```bash
npm install
npx expo start
```

Open it in Expo Go on a phone, or press `w` for the web build. No keys are needed. With an empty `.env` the app runs in demo mode: seeded Berkeley neighbors and listings, on-device storage, and canned AI results for six sample items, so the demo works with no signal.

On first launch the seeded photos load from Unsplash and are cached on the device. Open the app once on wifi before a demo.

### Demo controls

- **Samples** on the scanner runs a full scan on a sample photo: sofa, office chair, bookshelf, microwave, broken chair, mattress.
- **Long-press the Curbside wordmark** on the scanner to open the debug panel. It shows scan latency and whether the result was live or mocked, switches you between Riley (you) and Maya (the neighbor), and resets all data.
- In demo mode a scripted neighbor claims what you publish, answers in chat, and stands in for the second phone at the QR handoff.

## Turn on the backend

1. Create a Supabase project. Enable anonymous sign-ins (Authentication > Providers).
2. Apply the schema and seed the donation places:
   ```bash
   supabase link --project-ref <ref>
   supabase db push
   psql "$DATABASE_URL" -f supabase/seed.sql
   ```
3. Deploy the scanner function and give it a key:
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-... ANTHROPIC_MODEL=claude-sonnet-5-5
   supabase functions deploy scan-item
   ```
4. Copy `.env.example` to `.env` and fill in `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Scans now go to the live model. Set `EXPO_PUBLIC_BACKEND=supabase` to sync listings and chat as well.
5. Optional: `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed` creates the demo neighbors and their listings in the live project.

The backend half has not yet been run against a live project. See [docs/LIMITATIONS.md](docs/LIMITATIONS.md).

## How it fits together

```
phone                                         Supabase
─────                                         ────────
scanner ─ on-device check (blur, light)
        ─ resize to 1024px ──────────────────▶ scan-item edge function
                                                 Claude vision, one forced tool call
                                                 zod validation, one retry with the errors
        ◀── validated JSON ──────────────────   logs latency to scan_logs
        └ falls back to a canned result on any failure or timeout

zustand store (persisted on device)  ◀──────▶ Postgres + PostGIS, RLS on every table
  listings, claims, chat, handoffs              Realtime on messages and claims
  every action lands locally first,             Storage bucket for listing photos
  then mirrors to Supabase when synced
```

**Scanner.** `src/app/(tabs)/index.tsx`. Capture runs a fast pre-check on a 64px thumbnail (brightness and Laplacian variance for blur, `src/ai/precheck.ts`) before anything is uploaded. Auto mode fires when the accelerometer says the phone has been still for about a second. The scan contract lives in one file, `supabase/functions/_shared/schema.ts`, used by both the edge function and the app. Each field carries a confidence score, and the edit screen marks anything under 0.7 for a second look.

**Safety routing.** The model flags mattresses, car seats, cribs, refrigerant appliances, hazardous materials and prohibited items. A flagged item can't be published to the marketplace and goes to the finder instead, with a plain explanation.

**Good Score.** `src/lib/goodScore.ts`. The type of place sets the base score (100, 80, 60, 40, 20). Smaller adjustments for pickup, open now, tax receipt and distance only reorder places inside a type, so a paid hauler can never outrank a charity. Places that won't take the item are listed separately with the reason. The "How we rank" sheet in the app shows the same rules.

**Privacy.** Listings only store a point blurred to about 300 m, recomputed by a database trigger. The exact address is in `listing_private`, which row-level security opens to the owner and to a claimant the owner has confirmed.

**Impact.** `src/lib/impact.ts`, mirrored in the `complete_handoff` SQL function. Weight is the middle of the item's weight class. CO2e is weight times a category footprint factor, counted at 50% because not every rehomed item replaces a new purchase. Money saved is the typical used price minus what the neighbor paid. The assumptions are shown in the app.

### Layout

```
src/app/            screens (Expo Router)
  (tabs)/           scanner, nearby feed, messages, impact
  review.tsx        edit the AI listing, then publish
  rehome.tsx        donation and disposal finder
  listing/[id]      item detail and claim queue
  chat/[id]         chat, pickup time, porch or public meetup
  handoff/[id]      QR code, scan, rating, tip
src/ai/             scan client, mocks, on-device pre-check
src/data/           store, types, seed data, Supabase sync
src/lib/            Good Score, impact math, formatting, calendar and maps links
src/theme/          design tokens (color, type scale, spacing, motion)
src/components/     shared UI
supabase/           migration, edge function, versioned prompt, seed
```

## Design

Warm paper and forest green with terracotta saved for a few moments: the shutter, prices on free items, the "check this" marks. Fraunces for headings, Instrument Sans for everything else, and Lucide icons at one stroke weight. The feed alternates a full-width photo with an uneven pair. Dark mode keeps the warmth with a brown-black base. All motion checks the reduced-motion setting.

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Expo dev server |
| `npm run typecheck` | Strict TypeScript for the app and scripts |
| `npm run export:web` | Production web build into `dist/` |
| `npm run seed:sql` | Regenerate `supabase/seed.sql` from `src/data/seed/places.ts` |
| `npm run seed` | Same, plus demo users and listings in a live project |

## More

- [90-second demo script](docs/DEMO_SCRIPT.md)
- [Known limitations and next steps](docs/LIMITATIONS.md)

Seed photos are from [Unsplash](https://unsplash.com) under the Unsplash License. Their ids are in `src/data/seed/photos.ts`.
