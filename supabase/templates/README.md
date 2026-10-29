# Auth email templates

Paste these into Supabase → Authentication → Emails → Templates. The link sends a token hash to
`/auth/callback`, so it works in any browser, the email app's own included.

| Template | File | Subject |
| --- | --- | --- |
| Magic Link | `magic_link.html` | Your Swami sign-in link |
| Confirm signup | `confirm_signup.html` | Confirm your email for Swami |
