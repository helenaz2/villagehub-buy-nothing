# Phase 4 worker setup

Do this only after Phase 4 migration/deployment approval. No Docker is required.
These secrets are not Expo variables. Do not paste them into chat or Git.

1. Open Supabase project `iwffztmzngpnwpolhzkc` in the dashboard. In Edge Functions
   > Secrets, add `RATING_WORKER_KEY`. Generate a random value with at least 32
   random bytes using your password manager. Keep the value temporarily so it
   can be entered identically in Vault. This is a new dedicated worker key, not
   your Supabase service-role key, publishable key or account password.
2. Open the project's Vault page (Database > Vault, or search for Vault in the
   dashboard). Create a secret named `villagehub_rating_worker_key` with that
   exact same generated value.
3. In Vault create `villagehub_rating_worker_url` with this non-secret URL:
   `https://iwffztmzngpnwpolhzkc.supabase.co/functions/v1/rating-invitations`.
4. Tell the agent only that worker secrets are saved. Never send their values.

The Edge runtime supplies SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Those
remain on the server; do not copy them to the app. The function disables gateway
JWT verification because Cron is a service caller; its handler validates the
dedicated x-worker-key before making any privileged request. An ordinary user
JWT or the publishable key alone cannot invoke it.

The migration installs pg_cron and pg_net and schedules
`villagehub-rating-invitations` once a minute. It makes no HTTP request if there
are no due jobs or secrets are missing. Missing configuration leaves invitations
pending and is not reported as working delivery. Avoid editing any unrelated
Cron job or Vault secret.

After approval, deploy only rating-invitations with Supabase CLI's API bundler
(Docker-free). Confirm the deployed function and secrets, then run the approved
hosted test script. It intentionally waits at least five real minutes plus a
Cron tick, usually five to seven minutes, without changing server clocks.

The scheduler runs on the existing development project. Worker calls count
toward Edge Function usage and jobs/storage toward database usage. No paid plan
is requested. Costs depend on your project's limits and total usage.
