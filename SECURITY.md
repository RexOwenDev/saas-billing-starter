# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| `main` branch | ✓ |
| Tagged releases | ✓ (latest minor only) |
| Older releases | No |

---

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

To report a vulnerability:

1. Email **owenquintenta@gmail.com** with the subject line: `[SECURITY] saas-billing-starter — <short description>`
2. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact (what an attacker could do)
   - Any suggested mitigations you have identified
3. You will receive an acknowledgement within 48 hours
4. We aim to release a fix within 14 days for critical issues

---

## Out of scope

The following are not considered security vulnerabilities for this project:

- Issues in dependencies — report these to the respective upstream project
- Missing rate limiting on API routes in the skeleton (it's a starter template — production deployments should add their own)
- The use of `// nosemgrep` annotations — these are documented inline with justification

---

## Security design notes

Key security decisions in this codebase:

- **`SUPABASE_SERVICE_ROLE_KEY`** is only used server-side in the webhook handler. It never has a `NEXT_PUBLIC_` prefix and is never returned in API responses.
- **`STRIPE_SECRET_KEY`** is protected by `import "server-only"` on every file in `src/lib/stripe/`. The Next.js build will fail if any of these files is imported client-side.
- **Stripe HMAC verification** runs before any database access. Invalid signatures return 400 immediately with no further processing.
- **CSP headers** whitelist only `js.stripe.com` and `*.supabase.co` for external connections.
- **Cookie SameSite** is enforced to be at least `Lax` — `None` values are downgraded.
- **`noUncheckedIndexedAccess`** is enabled in TypeScript to prevent crashes from undefined array/object lookups in webhook payloads.

---

## Disclosure

Vulnerabilities responsibly disclosed will be credited in the release notes (unless the reporter prefers to remain anonymous).
