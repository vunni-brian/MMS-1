# MMS Release Notes

## Version 1.1.0

Release date: June 16, 2026

MMS `1.1.0` builds on the production-shaped `1.0.0` release with a comprehensive backend authorization audit, abuse and resilience hardening, production validation checks, and full documentation coverage. The system is now more resilient to malicious input, misconfiguration, and common attack vectors.

### What Changed in 1.1.0

**Backend Authorization Audit (Phase 10)**
- Audited all API route handlers for correct permission enforcement
- Verified that every mutating endpoint requires the appropriate `Permission` guard
- Confirmed role-based access control is consistently applied across all domains
- Ensured market-scoped data isolation is enforced for all cross-market queries
- Verified session token validation on every authenticated route

**Abuse and Resilience Hardening (Phase 11)**
- Added input max-length validation (`assertMaxLength`) to all unsafe POST/PUT/PATCH endpoints across auth, vendors, stalls, tickets, announcements, resources, utilities, penalties, payments, and fallback modules
- Wired HTML sanitization (`sanitizeText`) into every user-facing text input handler to prevent stored XSS
- Applied defense-in-depth: all user text is sanitized before storage and validated for length limits
- Created 30 abuse-scenario unit tests covering:
  - Max-length boundary conditions (valid, overflow, null, undefined)
  - HTML entity encoding and XSS pattern prevention (script tags, event handlers, iframes, href injection)
  - Large payload stress testing
  - Combined sanitize-then-validate flows
- Fixed pre-existing syntax error in tickets module (stray closing brace)

**Production Validation (Phase 12)**
- Added startup-time production configuration validation that checks for:
  - `MMS_SEED_ON_BOOT` disabled in production
  - Pesapal credentials configured when payments are enabled
  - IPN URL and ID registered for payment gateway
  - Production Pesapal base URL (not sandbox)
  - Production database URL (not localhost)
  - SMS sandbox mode disabled for production
  - Database connectivity before accepting traffic
- Configuration issues log warnings in development and block with errors in production

### Included Capabilities (1.0.0 + 1.1.0)

- Role-based dashboards for vendors, managers, officials, and administrators
- Stall booking and application review workflow
- Pesapal payment initiation, callback/IPN handling, confirmation, and receipt evidence
- Payment statuses: pending, completed, failed, and cancelled
- Obligation statuses: unpaid, pending payment, paid, overdue, and cancelled
- Utilities billing with fixed, metered, and estimated charge patterns
- Market-scoped reporting, audit trails, and financial reconciliation views
- Vendor notifications, complaint handling, and coordination messaging
- Admin governance for charge categories and payment infrastructure
- Optional Supabase integration for Auth and Storage
- Optional Africa's Talking SMS delivery
- Local/demo USSD and SMS fallback simulation
- Input max-length validation on all unsafe endpoints
- HTML sanitization on all user-facing text fields
- Production config validation at startup

### UI Direction

- Premium operations-console layout
- Calm, neutral-first visual system
- Flat cards with subtle borders and minimal shadow
- Structured page headers, scope bars, KPI strips, tables, and detail drawers
- Consistent status badges and lifecycle wording
- Human-readable dates, currency, references, and receipts
- Color reserved for state and evidence, not decoration

### Verification

The release has been verified with:

```bash
npm run build        # Vite production build
npm run typecheck    # TypeScript strict type checking
npm test             # Unit tests (127 tests across 19 files)
npx eslint .         # ESLint static analysis
```

Latest verification result:

- Build: passed
- TypeScript: compiles clean (0 errors)
- Tests: passed, 19 test files and 127 tests
- Lint: passed

### Known Notes

- The Vite production build still reports a large JavaScript chunk warning. This is a performance optimization note, not a release blocker.
- Hosted production deployments should keep `MMS_SEED_ON_BOOT=false`.
- Pesapal should remain on sandbox credentials until the live gateway credentials, callback URL, IPN URL, and IPN ID are fully configured.
- The startup validator will log critical configuration warnings if production-critical environment variables are missing or set to unsafe values.

