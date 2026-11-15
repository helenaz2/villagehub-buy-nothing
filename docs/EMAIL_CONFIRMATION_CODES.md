# Confirm signup with an email code

The app keeps email/password signup and email verification. After signup, enter
the email code inside Expo Go or the web app. `verifyOtp` establishes the session
on that client; no email link, localhost redirect or PKCE browser exchange is
needed. Subsequent logins still use the existing password.

## Required hosted configuration (owner dashboard action)

1. Open Supabase project `iwffztmzngpnwpolhzkc`.
2. Open **Authentication → Email Templates** (in dashboards with the newer layout,
   **Authentication → Emails → Templates**).
3. Choose **Confirm signup**.
4. Set the subject to **Your VillageHub confirmation code**.
5. Replace the email body with the contents of
   `supabase/templates/confirmation.html`. The important variable is
   `{{ .Token }}`; use the exact braces, capitalization and leading dot.
6. Save. Keep email confirmation enabled. No database migration, Edge deployment,
   API key change or redirect allowlist change is needed for code confirmation.

The checked-in config/template applies to local Supabase only; editing it does
not change hosted Auth. SMTP permissions, delivery limits and server-side token
expiry/rate limits still apply. This change does not configure or purchase an
email provider. Existing password-reset links are unchanged.

## Verify on Expo Go

1. Reload the updated app and create an account with an email you control.
2. Read the email on any device. Return to Expo Go and enter its numeric code.
3. Confirm that Explore opens, then restart the app to check session persistence.
4. To resume an unconfirmed signup, use Log in → enter email → **Confirm email
   with a code** → **Resend code**. Use the newest email, not an old link/code.
5. An invalid/expired/reused code should fail without granting a session. Resend
   has a client cooldown and remains subject to Supabase's server limits.

Codes/passwords are not logged or stored as drafts. The optional street remains
in the existing private device-local draft until the matching account signs in.
Search/session/UI behavior is preserved. The code-entry screen supports numeric
keyboard, paste and one-time-code autofill, including leading zeroes.

Local service tests cover verification arguments/session handling, malformed
codes, expired/reused errors and resend behavior. Real email delivery, template
configuration, expiry/reuse enforcement and device autofill remain unverified
until the owner performs the flow above. No real signup emails were sent by tests.

References: [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates),
[verifyOtp](https://supabase.com/docs/reference/javascript/auth-verifyotp),
[resend](https://supabase.com/docs/reference/javascript/auth-resend).
