# Edge Functions roadmap

The Phase 4 rating-invitations worker is deployed after explicit owner approval.
It verifies a dedicated server-only invocation key, then calls the restricted
process_rating_jobs RPC using its server environment. Supabase Cron and pg_net
invoke it with the matching key from Vault. See docs/PHASE4_WORKER_SETUP.md.

The app's TypeScript build excludes these Deno files. Run
`npm run typecheck:functions` for their separate typecheck and `npm run test:phase4`
for portable handler/security tests. Deployment and safe missing-configuration
response were verified. The owner configured worker secrets and the full hosted
test passed, including real delayed Cron-to-Edge delivery and two-way ratings.

Phase 5 adds category review and photo analysis. AI keys and any privileged keys
must remain server-side, never in Expo environment variables.

category-review and photo-autofill are deployed after explicit owner approval.
They validate the user with Supabase Auth before reserving bounded provider work.
The provider key remains in Edge secrets. Read docs/PHASE5_HOSTED_REVIEW.md for
the exact migration/deployment/paid-test approval scope. Run npm run test:phase5
and npm run typecheck:functions for local checks; no paid call is made by them.
The hosted suite passed real category review, shared Realtime, vision recognition,
authorization and quotas using three approved paid AI calls. Browser/native
photo preprocessing and interactive UI still require manual verification.

listing-recommendations is deployed after separate approval. It reuses the AI
auth/provider helpers and quota ledger, interprets bounded conversation context
into search filters, and returns only live database-backed recommendations. Its
hosted two-account suite passed with four paid AI calls. See
docs/RECOMMENDATION_CHATBOT_REVIEW.md for search, quota and verification details.
