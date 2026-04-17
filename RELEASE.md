# MMS Release Notes

## Version 1.0.0

Release date: April 17, 2026

MMS `1.0.0` is the first production-shaped release of the Market Management System. It establishes the app as a premium market operations console for vendors, managers, officials, and administrators.

### Release Summary

This release focuses on making MMS feel calm, trustworthy, and ready for daily market operations. The interface has been refined around structured workspaces, role-specific dashboards, clean tables, evidence drawers, payment status discipline, market-scoped data, and a neutral visual system where color is used only when it carries operational meaning.

### Included Capabilities

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
npm run build
npm test
```

Latest verification result:

- Build: passed
- Tests: passed, 10 test files and 29 tests

### Known Notes

- The Vite production build still reports a large JavaScript chunk warning. This is a performance optimization note, not a release blocker.
- Hosted production deployments should keep `MMS_SEED_ON_BOOT=false`.
- Pesapal should remain on sandbox credentials until the live gateway credentials, callback URL, IPN URL, and IPN ID are fully configured.

