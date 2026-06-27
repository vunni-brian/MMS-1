# Market Management System (MMS)

MMS is a full-stack market operations platform for municipal and private market administration. It supports vendor onboarding, stall allocation, billing, payment tracking, complaints, official oversight, reporting, audit trails, and staff administration.

The system is built as a React/Vite frontend backed by a TypeScript Node API and PostgreSQL database.

Current application version: `1.0.0`

## Contents

- [What the system does](#what-the-system-does)
- [User roles](#user-roles)
- [How the system works](#how-the-system-works)
- [Core workflows](#core-workflows)
- [Technical architecture](#technical-architecture)
- [Repository structure](#repository-structure)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [Demo accounts](#demo-accounts)
- [Database and seed data](#database-and-seed-data)
- [API overview](#api-overview)
- [Frontend routes](#frontend-routes)
- [Security model](#security-model)
- [Payments](#payments)
- [Notifications and SMS](#notifications-and-sms)
- [Files and storage](#files-and-storage)
- [Testing and quality checks](#testing-and-quality-checks)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## What the system does

MMS centralizes the daily operations of a market authority. It gives vendors a self-service portal and gives managers, officials, and administrators operational consoles for supervision.

The major capabilities are:

- Vendor registration with phone verification, identity details, profile image, National ID document, and LC letter upload.
- Vendor approval and rejection by market managers.
- Stall listing, publishing, reservation, booking review, payment marking, and confirmation.
- Payment initiation through Pesapal or manual receipt workflow.
- Billing controls for market dues, utilities, penalties, booking fees, and payment gateway availability.
- Utility charge creation, calculation, cancellation, and payment tracking.
- Penalty creation, cancellation, and payment tracking.
- Complaint and ticket management with priority, lifecycle state, comments, escalation, SLA data, and audit history.
- Notifications delivered in-app and optionally through SMS.
- Reports for revenue, dues, ticket activity, financial audit, and general audit logs.
- Coordination messages and resource requests between managers and officials.
- Staff invitation and role/permission management for administrative users.

## User roles

The application is role based. Each role sees a different workspace and has a different permission set.

### Vendor

Vendors use MMS to:

- Register with personal, business, and identity information.
- Verify registration through OTP.
- Wait for manager approval before accessing protected vendor actions.
- View assigned and available stalls.
- Reserve stalls.
- Pay booking, utility, or penalty charges.
- Submit and track complaints.
- Read notifications.
- Manage their profile.

### Manager

Managers operate at market level. They can:

- Review pending vendor registrations.
- Approve or reject vendors.
- View vendor documents and activity.
- Reset vendor passwords when required.
- Create and update stalls for their market.
- Review booking requests.
- Mark bookings paid or confirmed.
- Create utility charges and penalties.
- Resolve and escalate complaints.
- View market reports and audit records.
- Send coordination messages.
- Create resource requests for officials.

### Official

Officials provide regional or authority-level oversight. They can:

- View performance across markets.
- Review financial and operational reports.
- Monitor compliance and audit activity.
- Review resource requests.
- Participate in coordination messaging.
- Track complaints and operational health.

### Admin

Admins control the system-level workspace. They can:

- Manage staff users.
- Invite managers and officials.
- Configure role permissions and access metadata.
- View system-wide dashboards.
- Manage billing controls.
- View audit records and reports.
- Coordinate across markets.

## How the system works

At runtime, the browser frontend calls the API using `VITE_API_BASE_URL`. The API validates the request, authenticates the bearer token when required, checks role permissions inside each module, reads or writes PostgreSQL data, and returns JSON responses to the frontend.

High-level request flow:

```text
Browser UI
  -> src/lib/api.ts
  -> HTTP request to API
  -> server/main.ts route matcher
  -> server/modules/* route handler
  -> server/lib/* services
  -> PostgreSQL database
  -> JSON response
  -> React Query cache and page UI update
```

The backend uses a custom HTTP server instead of Express. Routes are declared in `server/modules/*` and assembled in `server/main.ts`. Shared concerns such as request parsing, authentication, session handling, database access, permissions, payments, storage, SMS, and validation live in `server/lib/*`.

The frontend is a single-page React application. Routes are defined in `src/App.tsx`. Protected routes are wrapped with `ProtectedRoute`, and vendor-only actions are additionally guarded by `VendorApprovalGuard`.

## Core workflows

### 1. Vendor registration

1. A vendor opens `/register`.
2. The vendor submits name, email, phone, password, market, National ID number, district, product section, profile image, National ID document, and LC letter.
3. The frontend converts uploaded files to base64 payloads.
4. The API creates an OTP challenge and stores the registration data.
5. If Africa's Talking is configured, the OTP can be sent by SMS. In development, SMS can be simulated or inspected through logs and seeded behavior.
6. The vendor enters the OTP.
7. The API verifies the OTP, creates the vendor account, stores uploaded files, and creates a pending vendor profile.
8. The vendor can log in but sensitive vendor actions are blocked until approval.

### 2. Vendor approval

1. A manager opens the vendor management page.
2. The manager reviews vendor profile data and documents.
3. The manager approves or rejects the vendor.
4. The API updates `vendor_profiles.approval_status`.
5. Approved vendors can reserve stalls and make payments. Rejected vendors remain blocked from protected vendor workflows.

### 3. Stall and booking lifecycle

1. Managers create and publish stalls for a market.
2. Vendors browse available stalls.
3. A vendor reserves a stall, creating a booking.
4. Managers review bookings.
5. Bookings can be approved, rejected, marked paid, and confirmed.
6. Stall status and assigned vendor data are updated as the workflow progresses.

### 4. Billing, utilities, and penalties

1. Billing charge types define whether each charge category is enabled.
2. Managers or admins can enable or disable charge categories.
3. Utility charges can be calculated by fixed amount or usage rate.
4. Penalties can be attached to vendors and optionally related to utility charges.
5. Vendors pay eligible outstanding charges.
6. Managers and admins can review payment status and receipt data.

### 5. Payments

Payments support two paths:

- Pesapal gateway checkout: the API creates a Pesapal order and returns a redirect or iframe URL.
- Manual receipt workflow: the user submits receipt details and optional receipt file for staff verification.

Pesapal callbacks and IPN events are handled by the API. Payment rows and payment attempt rows track status, external references, receipt messages, and verification details.

### 6. Complaints and tickets

1. Vendors create tickets with category, priority, subject, description, and optional attachment.
2. Managers and staff search and filter tickets.
3. Ticket status can move through lifecycle states.
4. Staff can add comments, resolve tickets, and escalate tickets.
5. Ticket changes are recorded for auditability.

### 7. Reports and audit

Reports aggregate operational and financial data:

- Revenue report.
- Dues report.
- Ticket report.
- Financial audit report.
- Audit event list.

Audit events record important activity with actor, role, market, action, entity type, entity id, details, and timestamp.

## Technical architecture

### Frontend

- React 18.
- Vite.
- TypeScript.
- React Router.
- TanStack Query.
- Tailwind CSS.
- shadcn/ui and Radix UI components.
- Lucide icons.
- Vercel Speed Insights in production.

Important frontend files:

- `src/App.tsx`: application route tree.
- `src/main.tsx`: React entry point.
- `src/lib/api.ts`: typed API client and session token handling.
- `src/contexts/AuthContext.tsx`: login, logout, MFA, session restoration.
- `src/components/ProtectedRoute.tsx`: route authorization guards.
- `src/components/AppLayout.tsx`: authenticated workspace shell.
- `src/config/permissions.ts`: frontend permission metadata.
- `src/pages/*`: role-specific and shared pages.
- `src/components/ui/*`: reusable UI primitives.

### Backend

- Node.js 22.
- TypeScript executed with `node --experimental-strip-types`.
- Native `node:http` server.
- PostgreSQL through `pg`.
- SQL migrations in `server/db/migrations`.
- Custom route matcher and JSON helpers in `server/lib/http.ts`.

Important backend files:

- `server/main.ts`: API server entry point and route registration.
- `server/config.ts`: environment loading and runtime configuration.
- `server/lib/db.ts`: PostgreSQL pool, migration runner, seed routine, query helpers.
- `server/lib/session.ts`: bearer-token authentication.
- `server/lib/security.ts`: password hashing and security helpers.
- `server/lib/permissions.ts`: backend role permissions.
- `server/lib/pesapal.ts`: Pesapal API integration.
- `server/lib/sms.ts`: Africa's Talking SMS integration.
- `server/lib/storage.ts`: local and optional Supabase storage.
- `server/modules/*`: API route handlers by domain.

### Backend modules

- `auth.ts`: login, logout, registration, OTP, MFA, staff invites, profile update.
- `markets.ts`: market listing and market manager lookup.
- `vendors.ts`: vendor listing, profile management, documents, approval, rejection.
- `stalls.ts`: stall CRUD, reservations, bookings, booking review.
- `payments.ts`: payment initiation, Pesapal callbacks, receipt files, verification.
- `billing.ts`: charge type listing and enable/disable controls.
- `utilities.ts`: utility charge management.
- `penalties.ts`: penalty management.
- `tickets.ts`: complaints, comments, status changes, escalation.
- `reports.ts`: revenue, dues, audit, ticket and financial reports.
- `notifications.ts`: in-app notification listing and delivery processing.
- `coordination.ts`: coordination messages.
- `resources.ts`: manager resource requests and official review.
- `fallback.ts`: optional USSD/SMS fallback simulation.
- `health.ts`: extended health route definitions. At the moment `server/main.ts` exposes the simple `GET /health` check directly.

## Repository structure

```text
.
|-- api/                         Serverless/API integration entry points
|-- docs/                        Design notes and captured screenshots
|-- infra/                       Terraform and monitoring infrastructure
|-- public/                      Static frontend assets
|-- runtime/                     Local runtime data, uploads, generated files
|-- scripts/                     Operational scripts
|-- server/                      Backend API source
|   |-- db/
|   |   |-- migrations/          SQL schema migrations
|   |   `-- seed.ts              Seed command entry point
|   |-- lib/                     Shared backend services
|   `-- modules/                 API route modules
|-- src/                         React frontend source
|   |-- components/              App components and UI primitives
|   |-- config/                  Frontend config
|   |-- contexts/                React contexts
|   |-- hooks/                   Shared hooks
|   |-- lib/                     API client and utilities
|   |-- pages/                   Route pages
|   |-- test/                    Vitest tests
|   `-- types/                   Shared frontend types
|-- wmms/                        Extra screenshots and system documentation
|-- docker-compose.yml           Local container stack
|-- Dockerfile                   Production API image
|-- openapi.yaml                 API contract reference
|-- package.json                 Scripts and dependencies
`-- README.md                    This file
```

## Local setup

### Requirements

- Node.js 22.x.
- npm.
- PostgreSQL 16 or compatible PostgreSQL server.
- Optional: Docker Desktop if using the container stack.

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and adjust values for your machine:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

The default local API URL is `http://localhost:3001`. The default Vite URL is usually `http://localhost:5173`.

### 3. Start PostgreSQL

Create a database named `mms`, or use Docker:

```bash
docker compose up -d postgres
```

The default database URL is:

```text
postgresql://postgres:postgres@localhost:5432/mms
```

### 4. Run migrations

```bash
npm run db:migrate
```

### 5. Seed demo data

```bash
npm run db:seed
```

### 6. Start the API

```bash
npm run dev:api
```

The API listens on:

```text
http://localhost:3001
```

### 7. Start the frontend

In another terminal:

```bash
npm run dev:web
```

Open the Vite URL shown in the terminal, normally:

```text
http://localhost:5173
```

## Environment variables

The application reads `.env` from the repository root in `server/config.ts`.

Common variables:

| Variable | Purpose |
| --- | --- |
| `API_PORT` | Backend HTTP port. Defaults to `3001`. |
| `APP_ENV` | App environment such as `development` or `production`. |
| `APP_NAME` | Display/system name. Defaults to `MMS`. |
| `APP_URL` | Comma-separated allowed frontend origins. |
| `API_URL` | Public API URL used by backend-generated links/logging. |
| `VITE_API_BASE_URL` | Frontend API base URL. |
| `DATABASE_URL` | Main PostgreSQL connection string. |
| `MIGRATION_DATABASE_URL` | Optional separate connection string for migrations. |
| `DATABASE_SSL` | Enables PostgreSQL SSL when `true`. |
| `MMS_AUTO_MIGRATE` | Runs migrations when API boots if `true`. |
| `MMS_SEED_ON_BOOT` | Seeds data on API boot. Defaults to true outside production unless disabled. |
| `SUPABASE_URL` | Optional Supabase project URL. |
| `SUPABASE_ANON_KEY` | Optional Supabase anonymous key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional Supabase service role key for auth/storage sync. |
| `SUPABASE_STORAGE_BUCKET` | Storage bucket name. Defaults to `mms-uploads`. |
| `AFRICAS_TALKING_USERNAME` | Africa's Talking username. |
| `AFRICAS_TALKING_API_KEY` | Africa's Talking API key. |
| `AFRICAS_TALKING_FROM` | Optional SMS sender ID/short code. |
| `AFRICAS_TALKING_USE_SANDBOX` | Uses Africa's Talking sandbox when `true`. |
| `OTP_TTL_MINUTES` | OTP expiry duration. |
| `SESSION_TTL_HOURS` | Session expiry duration. |
| `PESAPAL_CONSUMER_KEY` | Pesapal consumer key. |
| `PESAPAL_CONSUMER_SECRET` | Pesapal consumer secret. |
| `PESAPAL_BASE_URL` | Pesapal API base URL. Defaults to sandbox. |
| `PESAPAL_CALLBACK_URL` | Frontend callback URL after checkout. |
| `PESAPAL_IPN_URL` | Backend IPN webhook URL. |
| `PESAPAL_IPN_ID` | Registered Pesapal IPN ID. |
| `PESAPAL_USE_IFRAME` | Uses iframe checkout when `true`. |
| `PAYMENTS_ENABLED` | Disables payment actions when set to `false`. |
| `NOTIFICATION_RETRY_COUNT` | Delivery retry count for notification processing. |
| `PAYMENT_SETTLEMENT_DELAY_MS` | Delay used while checking payment settlement status. |
| `MMS_ENABLE_FALLBACK_SIMULATION` | Enables USSD/SMS fallback simulation routes. |

## Demo accounts

After seeding, the following accounts are available.

| Role | Phone | Password | Notes |
| --- | --- | --- | --- |
| Admin | `+256701111222` | `Admin123!` | System administrator. |
| Official | `+256700600700` | `Official123!` | Authority-level official. |
| Manager | `+256700500600` | `Manager123!` | Wandegeya Market manager. |
| Vendor | `+256700100200` | `Vendor123!` | Approved vendor. |

Seed data also includes extra managers, officials, vendors, markets, stalls, bookings, utility charges, penalties, payments, and tickets for richer dashboards.

Privileged accounts can require MFA. In local seeded/dev mode, inspect API logs or the database OTP rows if an MFA challenge is created.

## Database and seed data

Migrations live in `server/db/migrations` and are run in lexical order.

Important tables include:

- `markets`: market records.
- `locations`: location hierarchy for regions, cities, districts, divisions, and markets.
- `users`: all account identities.
- `staff_profiles`: manager/official/admin metadata.
- `vendor_profiles`: vendor-specific registration, identity, approval, and document metadata.
- `sessions`: bearer-token sessions.
- `otp_challenges`: registration and MFA OTP challenges.
- `stalls`: market stalls.
- `bookings`: stall reservation and allocation workflow.
- `payments`: booking, utility, and penalty payment records.
- `payment_attempts`: gateway or manual payment attempts.
- `payment_webhook_events`: received payment webhook/IPN events.
- `charge_types`: global or market-specific billing toggles.
- `utility_charges`: water, power, waste, or other utility bills.
- `penalties`: compliance or late payment penalties.
- `notifications`: user-facing notification records.
- `notification_deliveries`: channel delivery attempts.
- `tickets`: complaints.
- `ticket_updates`: status/comment history.
- `ticket_attachments`: uploaded complaint files.
- `ticket_audit_log`, `ticket_assignments`, `ticket_escalations`: enterprise ticket lifecycle records.
- `coordination_messages`: manager/official coordination posts.
- `resource_requests`: manager resource requests and official reviews.
- `audit_events`: operational audit trail.
- `fallback_queries`: optional USSD/SMS simulation history.

Run database commands:

```bash
npm run db:migrate
npm run db:seed
npm run db:check
```

## API overview

The OpenAPI reference is in `openapi.yaml`. The current implementation is organized by route modules.

Common endpoints:

| Area | Endpoints |
| --- | --- |
| Health | `GET /health` |
| Auth | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `PATCH /auth/me`, `POST /auth/register-vendor`, `POST /auth/verify-registration-otp` |
| MFA | `POST /auth/verify-manager-mfa`, `POST /auth/verify-privileged-mfa` |
| Staff | `GET /auth/users`, `POST /auth/staff`, `POST /auth/managers` |
| Markets | `GET /markets`, `GET /markets/:id/managers` |
| Vendors | `GET /vendors`, `GET /vendors/:id`, `PATCH /vendors/:id/profile`, `POST /vendors/:id/approve`, `POST /vendors/:id/reject` |
| Documents | `GET /vendors/:id/documents/:type`, `GET /users/:id/profile-image` |
| Stalls | `GET /stalls`, `POST /stalls`, `PATCH /stalls/:id`, `POST /stalls/:id/reservations` |
| Bookings | `GET /bookings`, `POST /bookings/:id/approve`, `POST /bookings/:id/reject`, `POST /bookings/:id/mark-paid`, `POST /bookings/:id/confirm` |
| Payments | `GET /payments`, `POST /payments/initiate`, `POST /payments/webhooks/pesapal`, `GET /payments/pesapal/callback-status` |
| Receipts | `GET /payments/:id/receipt`, `GET /payments/:id/receipt-file`, `POST /payments/:id/verify` |
| Billing | `GET /billing/charge-types`, `PATCH /billing/charge-types/:id` |
| Utilities | `GET /utility-charges`, `POST /utility-charges`, `POST /utility-charges/:id/cancel` |
| Penalties | `GET /penalties`, `POST /penalties`, `POST /penalties/:id/cancel` |
| Tickets | `GET /tickets`, `POST /tickets`, `GET /tickets/search`, `PUT /tickets/:ticketNumber/status` |
| Ticket actions | `POST /tickets/:ticketNumber/comments`, `POST /tickets/:ticketNumber/resolve`, `POST /tickets/:ticketNumber/escalate` |
| Reports | `GET /reports/revenue`, `GET /reports/dues`, `GET /reports/tickets`, `GET /reports/financial-audit`, `GET /audit` |
| Notifications | `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` |
| Coordination | `GET /coordination/messages`, `POST /coordination/messages` |
| Resources | `GET /resource-requests`, `POST /resource-requests`, `PATCH /resource-requests/:id` |
| Fallback | `POST /fallback/ussd`, `POST /fallback/sms` |

Authenticated requests use:

```text
Authorization: Bearer <session-token>
```

The frontend stores the token in `localStorage` under `mms.session.token`.

## Frontend routes

Public routes:

- `/`: landing/index route.
- `/login`: sign-in.
- `/register`: vendor registration.
- `/payments/callback`: Pesapal checkout callback handler.

Vendor routes:

- `/vendor`
- `/vendor/stalls`
- `/vendor/payments`
- `/vendor/complaints`
- `/vendor/profile`

Manager routes:

- `/manager`
- `/manager/vendors`
- `/manager/stalls`
- `/manager/payments`
- `/manager/complaints`
- `/manager/billing`
- `/manager/reports`
- `/manager/audit`
- `/manager/coordination`
- `/manager/profile`

Official routes:

- `/official`
- `/official/markets`
- `/official/vendors`
- `/official/compliance`
- `/official/analytics`
- `/official/billing`
- `/official/reports`
- `/official/audit`
- `/official/coordination`
- `/official/profile`

Admin routes:

- `/admin`
- `/admin/users`
- `/admin/billing`
- `/admin/reports`
- `/admin/audit`
- `/admin/coordination`
- `/admin/profile`

## Security model

Security is handled in several layers:

- Passwords are hashed before storage.
- Sessions are stored server-side and represented client-side with bearer tokens.
- Session expiry is controlled by `SESSION_TTL_HOURS`.
- OTP challenges expire according to `OTP_TTL_MINUTES`.
- Managers, officials, and admins can require MFA.
- Frontend routes are protected by role-based route guards.
- Backend modules enforce authorization before sensitive operations.
- CORS is restricted to configured `APP_URL` origins.
- Vendor actions are blocked until vendor approval.
- Uploaded files are served through authenticated API endpoints instead of direct public paths.
- Audit events record important operational actions.

## Payments

Pesapal configuration is controlled by:

- `PESAPAL_CONSUMER_KEY`
- `PESAPAL_CONSUMER_SECRET`
- `PESAPAL_BASE_URL`
- `PESAPAL_CALLBACK_URL`
- `PESAPAL_IPN_URL`
- `PESAPAL_IPN_ID`
- `PESAPAL_USE_IFRAME`

Register a Pesapal IPN endpoint with:

```bash
npm run pesapal:register-ipn
```

For local development, Pesapal callbacks require a public tunnel such as ngrok if Pesapal needs to reach your machine.

Manual receipt workflow can be used when gateway payment is not available. Staff can verify or reject submitted receipts.

## Notifications and SMS

The notification system stores records in `notifications` and delivery attempts in `notification_deliveries`.

The API starts a background notification delivery loop every two seconds from `server/main.ts`. It processes pending deliveries and retries according to `NOTIFICATION_RETRY_COUNT`.

SMS delivery uses Africa's Talking when credentials are configured:

- `AFRICAS_TALKING_USERNAME`
- `AFRICAS_TALKING_API_KEY`
- `AFRICAS_TALKING_FROM`
- `AFRICAS_TALKING_USE_SANDBOX`

Without SMS credentials, the system can still use in-app notifications and local development behavior.

## Files and storage

Uploaded files include:

- Vendor profile images.
- National ID documents.
- LC letters.
- Ticket attachments.
- Manual payment receipt files.

By default, files are stored under:

```text
runtime/uploads
```

Supabase storage can be enabled by setting:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`

## Testing and quality checks

Run unit tests:

```bash
npm run test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Run lint:

```bash
npm run lint
```

Build the frontend:

```bash
npm run build
```

Preview the built frontend:

```bash
npm run preview
```

## Deployment

### Docker Compose

The repository includes a local container stack:

```bash
docker compose up --build
```

Primary services:

- `postgres`: PostgreSQL database on port `5432`.
- `redis`: Redis service on port `6379`.
- `api`: MMS API on port `3001`.
- `web`: Vite development frontend on port `5173`.

The compose file also defines monitoring services:

- `prometheus`: metrics collection on port `9090`.
- `grafana`: dashboards on port `3000`.

If the Prometheus or Grafana config directories are not present in `infra/`, comment out those monitoring services or add the expected config files before starting the full compose stack.

Note: the backend code in this repository primarily uses PostgreSQL for sessions/data. Redis is provisioned by the compose stack for infrastructure readiness and future caching/session use.

### API container

Build the API image:

```bash
docker build -t mms-api .
```

Run it with environment variables:

```bash
docker run --env-file .env -p 3001:3001 mms-api
```

### Render and Vercel

The repository includes:

- `render.yaml` for hosted API deployment.
- `vercel.json` for frontend hosting.

Typical hosted setup:

1. Deploy PostgreSQL or use a managed PostgreSQL provider.
2. Deploy the API with `DATABASE_URL`, `APP_URL`, `API_URL`, and integration secrets.
3. Deploy the frontend with `VITE_API_BASE_URL` pointing to the hosted API.
4. Configure Pesapal callback/IPN URLs to use the hosted public URLs.
5. Disable development-only seed behavior in production unless intentionally needed:

```text
MMS_SEED_ON_BOOT=false
MMS_AUTO_MIGRATE=false
```

Run migrations intentionally during release or deployment setup.

## Operational scripts

Useful scripts in `package.json`:

| Script | Purpose |
| --- | --- |
| `npm run dev:web` | Start Vite development server. |
| `npm run dev:api` | Start API in watch mode. |
| `npm run api` | Start API without watch mode. |
| `npm run start:api` | Production-style API start command. |
| `npm run db:migrate` | Run SQL migrations. |
| `npm run db:seed` | Seed demo data. |
| `npm run db:check` | Check database connectivity/data. |
| `npm run pesapal:register-ipn` | Register Pesapal IPN URL. |
| `npm run build` | Build frontend assets. |
| `npm run lint` | Run ESLint. |
| `npm run test` | Run Vitest tests. |

Additional scripts:

- `scripts/backup-database.ts`: database backup helper.
- `scripts/provision-hosted-test-users.ts`: hosted test user provisioning.
- `scripts/step6-role-smoke.ts`: role-based smoke workflow.
- `scripts/capture-dashboard-pngs.mjs`: dashboard screenshot capture.
- `scripts/generate_architecture_doc.ps1`: architecture document generation.
- `scripts/generate-mms-tech-qa-docx.ts`: generate Panel Q&A .docx document.

## Troubleshooting

### API cannot connect to database

Check:

- PostgreSQL is running.
- `DATABASE_URL` is correct.
- The `mms` database exists.
- Firewall or Docker port mapping is not blocking port `5432`.

Then run:

```bash
npm run db:migrate
npm run db:check
```

### Frontend cannot reach API

Check:

- API is running on `http://localhost:3001`.
- `.env` contains `VITE_API_BASE_URL=http://localhost:3001`.
- Browser console does not show CORS errors.
- `APP_URL` includes your frontend origin, for example `http://localhost:5173`.

### Login works but protected pages redirect

Check:

- The session token exists in browser local storage under `mms.session.token`.
- The API `GET /auth/me` route returns the current user.
- The account role matches the route being opened.
- Vendor account is approved if accessing vendor protected workflows.

### MFA or OTP blocks local testing

Check:

- API logs for generated development OTP output.
- `otp_challenges` table for active challenge rows in local development.
- `OTP_TTL_MINUTES` if challenges expire too quickly.

### Payments do not complete

Check:

- `PAYMENTS_ENABLED` is not `false`.
- Pesapal credentials are set.
- `PESAPAL_CALLBACK_URL` points to the frontend callback page.
- `PESAPAL_IPN_URL` is publicly reachable.
- `PESAPAL_IPN_ID` matches the registered IPN endpoint.
- Local development uses a tunnel if external callbacks are required.

### Uploaded files are missing

Check:

- `runtime/uploads` exists and is writable.
- `MMS_DATA_DIR` points to the expected runtime directory if customized.
- Supabase storage variables are correct if remote storage is enabled.

### Migrations fail

Check:

- You are using PostgreSQL, not SQLite.
- The database user has schema modification permissions.
- `MIGRATION_DATABASE_URL` is set if the main database user cannot run migrations.
- Migrations are applied in order from `server/db/migrations`.

## Related documentation

- `openapi.yaml`: API contract reference.
- `RELEASE.md`: release notes.
- `docs/`: design notes and screenshots.
- `docs/MMS-Technical-Stack-APIs-Panel-QA.docx`: technical stack, APIs, and panel Q&A document.
- `wmms/`: additional system screenshots and documentation.
- `Market_Stall_Manager_Architecture_and_Design_Documentation.docx`: architecture/design document.
