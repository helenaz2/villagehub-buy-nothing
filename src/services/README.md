# Supabase services

- auth.ts: signup, login, reset, password update, and deduplicated PKCE callbacks.
- profiles.ts: general profiles and owner-only private address access.
- pending-address.ts: email-scoped, expiring device-local private signup draft.

The client lives in src/lib/supabase.ts. Real mode uses no seed data. Listings,
messaging, ratings, and AI/catalog adapters are pending later phases, not mocked
by these services. See docs/BACKEND_STATUS.md for verification and setup limits.
