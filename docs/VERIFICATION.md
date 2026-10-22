# Verification — 22 October 2026

- Next.js production webpack build: passed (Next.js 16.3.4, Node.js 24.19.0).
- TypeScript check and Git whitespace checks: passed.
- Domain tests: **17 passed**. Exact source quoting, unselected evidence, recipient checks, header injection, approval fingerprints, UTF-8 email drafts, sample/live separation, mocked provider errors and idempotent follow-ups.
- Production-server integration: **14 scenarios passed** (15 tests including the parent suite). Uses an isolated SQLite database, generated credentials and no provider key. Covers session authentication, spoofed Sites headers, malformed login, secure cookies, sample persistence, draft preparation, stale approval, duplicate approval, guest isolation, origin/body limits, explicit consent, missing-key failure, memory changes, runner scope/revocation and logout.
- Render Blueprint: passes the current official JSON Schema using Ajv 2020-12. Contains one free web service, no disk/paid database and no mandatory Nebius key. The authenticated Render CLI validation requires a separate CLI login; it was not completed.
- Build tooling: early Windows sandbox directory errors and a Turbopack child-process failure occurred. After granting generated-build/network access, the final webpack build passed. Local development and production scripts explicitly use webpack.
- Browser visual QA: blocked by a saved browser security setting for the local loopback origin, even after the user granted permission. Larger fonts, responsive layouts and themes are implemented, but the updated local UI has not yet been visually inspected or screenshotted.

Not verified yet: live Nebius inference, remote Turso persistence/restarts, Render-hosted behavior, third-party calendar import, or accessibility across actual browsers. Public hosting verification will be added after deployment. Email delivery, merchant submission, PDF OCR and inbox monitoring are not implemented. Mocked provider tests do not establish real Nebius compatibility.
