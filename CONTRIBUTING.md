# Contributing

Thank you for your interest in contributing to the Stripe SaaS Billing Starter.

---

## Ground rules

- Be respectful and constructive — see the [Code of Conduct](#code-of-conduct)
- Open an issue before starting large changes so we can discuss scope
- Keep PRs focused — one feature or fix per PR
- All changes require passing type-check and tests

---

## Development setup

See [SETUP.md](SETUP.md) for the full environment setup guide.

Quick version:

```bash
git clone https://github.com/RexOwenDev/saas-billing-starter.git
cd saas-billing-starter
npm install
cp .env.example .env.local
# fill in .env.local with your Stripe test keys and Supabase keys
npm run dev
```

---

## Before opening a PR

```bash
npm run type-check   # must pass with zero errors
npm test             # must pass with zero failures
npm run lint         # must pass with zero warnings (if configured)
```

If you are adding a new feature, include tests for it. If you are fixing a bug, include a test that would have caught the bug.

---

## Pull request checklist

- [ ] `npm run type-check` passes
- [ ] `npm test` passes
- [ ] New functionality has tests
- [ ] `CHANGELOG.md` updated (add an entry under a new `[Unreleased]` section)
- [ ] `README.md` updated if the public interface changed
- [ ] No secrets, API keys, or `.env.local` files committed

---

## Commit style

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add annual billing toggle to pricing table
fix: handle undefined trial_end in isTrialing helper
docs: add proration example to billing-concepts.md
test: add invoice.payment_failed webhook fixture
refactor: extract safeCookieOptions to shared util
chore: bump stripe to 17.x
```

---

## Reporting bugs

Use the [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.yml). Include:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Node.js and npm versions

---

## Requesting features

Use the [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.yml). Describe the use case — not just the solution — so we can find the best implementation together.

---

## Code of conduct

Be kind. Treat everyone with respect. Harassment, discrimination, and personal attacks will not be tolerated. If you experience or witness unacceptable behaviour, report it by opening a private issue or contacting the maintainer directly.

---

## License

By contributing you agree that your contributions will be licensed under the [MIT License](LICENSE).
