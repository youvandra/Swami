# Auth email templates

Paste these into Supabase → Authentication → Emails → Templates. The link builds on the Site URL and sends a token hash to
`/auth/callback`, so it works in any browser, the email app's own included, and needs no entry in the redirect allow list.

| Template | File | Subject |
| --- | --- | --- |
| Magic Link | `magic_link.html` | Your Swami sign-in link |
| Confirm signup | `confirm_signup.html` | Confirm your email for Swami |

Plain on purpose: no images, one link, a text fallback. That keeps them out of spam folders.
