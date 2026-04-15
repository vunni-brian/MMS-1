# Market Management System

Market Management System (`MMS`) is a full-stack market-operations app in a single repo.

- `src/` contains the Vite + React frontend
- `server/` contains the modular TypeScript API running on Node's built-in HTTP server
- `runtime/` stores local uploads and runtime artifacts when cloud storage is not configured

## Current implementation

- Role-based access for `vendor`, `manager`, `official`, and `admin`
- Vendor registration with ID upload, OTP phone verification, and manager approval
- Phone/password login with OTP MFA for privileged accounts
- Market-scoped management for vendors, stalls, bookings, payments, reports, and audit records
- Billing controls through `charge_types`, including global and market-specific enable/disable flags
- Centralized billing governance where only admins can toggle charge categories and payment infrastructure
- Pesapal checkout initiation with iframe or redirect support
- Callback/IPN-driven payment confirmation with provider-side status verification before marking payments complete
- Receipt generation after confirmed payment
- In-app notifications plus background SMS delivery through Africa's Talking when configured
- Ticketing, coordination messaging, and resource request review flows
- Optional USSD/SMS fallback simulation endpoints for development and demos
- Optional Supabase integration for Auth and Storage

## Payment status

The current payment provider in this repo is Pesapal.

Current payment flow:

1. Vendor books a stall.
2. Vendor starts a Pesapal checkout session for an approved booking.
3. The API creates a pending payment, submits the order to Pesapal, and returns a secure checkout URL.
4. Pesapal redirects the customer back to the frontend callback URL and also triggers the IPN URL.
5. The API calls Pesapal's transaction-status endpoint before changing the local payment state.
6. The payment is marked `completed` or `failed`.
7. A receipt is made available only after confirmed completion.

## Governance model

The system separates operational authority from policy authority. Managers run markets, officials oversee compliance, and admin centrally controls charge activation and payment infrastructure to avoid fragmented or unauthorized billing changes.

### Vendor role

The Vendor interacts only with active services and charges and cannot modify system billing settings.

### Manager role

The Manager handles day-to-day market operations, including vendor supervision, stall management, booking review, and complaint handling. Billing controls are visible but not editable by managers.

### Official role

The Official performs supervisory and oversight functions. This role may inspect billing states, reports, and audit logs, and participate in governance decisions, but does not directly toggle billing controls in the current implementation.

### Admin role

The Admin is the highest control level in the system and is responsible for centralized governance of billing and payment controls. The Admin can enable or disable market dues, utilities, penalties, booking fees, and the payment gateway. The Admin also has access to cross-market audit records, reports, and coordination tools.

| Charge / Control | Vendor | Manager | Official | Admin |
| --- | --- | --- | --- | --- |
| Market Dues | No access | View only | View / recommend | Toggle |
| Utilities | No access | View only | View only | Toggle |
| Penalties | No access | View only | View only | Toggle |
| Booking Fee | No access | View only | View only | Toggle |
| Payment Gateway | No access | View only | View only | Toggle |

## Tech stack

- Frontend: React 18, Vite, TypeScript, TanStack Query, shadcn/ui, Tailwind CSS
- Backend: Node 22, TypeScript, custom HTTP routing, PostgreSQL via `pg`
- Integrations: Pesapal, Africa's Talking, optional Supabase Auth and Storage
- Testing: Vitest

## Run locally

Requirements:

- Node 22.x
- PostgreSQL
- npm

Setup:

1. Copy `.env.example` to `.env`.
2. Update `DATABASE_URL` and any provider credentials you want to use locally.
3. Install dependencies:

```bash
npm install
```

4. Run migrations:

```bash
npm run db:migrate
```

5. Optionally seed demo data for local development or presentation demos only:

```bash
npm run db:seed
```

6. Start the API:

```bash
npm run dev:api
```

7. Start the frontend in a second terminal:

```bash
npm run dev:web
```

Default local URLs:

- Frontend: `http://localhost:8080`
- API: `http://localhost:3001`

Notes:

- The checked-in `.env.example` enables auto-migration and seed-on-boot for local development only. In production or hosted environments, set `MMS_SEED_ON_BOOT=false`.
- If Africa's Talking is not configured and the app is not running in production mode, SMS messages are logged to the API console instead of being sent.
- OTP codes are not returned in API responses.

## Verification

```bash
npm run lint
npm run build
npm test
```

Pesapal setup helper:

```bash
npm run pesapal:register-ipn
```

## Demo seed accounts

The following accounts are for local development and presentation demos only.
They must not be enabled or relied upon in production deployments.
In hosted environments, set `MMS_SEED_ON_BOOT=false` and provision real users through the proper administrative flow.

- Vendor: `+256700100200` / `Vendor123!`
- Vendor, pending approval: `+256770200300` / `Vendor123!`
- Vendor: `+256780300400` / `Vendor123!`
- Vendor, rejected: `+256701900100` / `Vendor123!`
- Vendor, Jinja: `+256702800900` / `Vendor123!`
- Manager, Kampala: `+256700500600` / `Manager123!`
- Manager, Jinja: `+256703700800` / `Manager123!`
- Official: `+256700600700` / `Official123!`
- Admin: `+256701111222` / `Admin123!`

Additional testing users:

- Admin, Vunni Brian: `vunnibrian14@gmail.com` / `+256764854885` / `Admin123!`
- Manager, Kigozi Duncan: `kigoziduncan72@gmail.com` / `+256743180351` / `Manager123!`
- Official, Nassanga Shakirah Kakembo: `nassanga681@gmail.com` / `+256758616651` / `Official123!`
- Vendor, Kakembo James: `jameskakembotj@gmail.com` / `+256705366092` / `Vendor123!`
- Vendor, Kemigisha Precious Loy: `preciousloy175@gmail.com` / `+256760749576` / `Vendor123!`

The additional manager and vendor testing accounts are assigned to the seeded `MMS Demo Test Market` so they do not override the existing Kampala and Jinja demo managers.

## Environment

Core app settings:

- `API_PORT` defaults to `3001`
- `APP_ENV` defaults to `development`
- `APP_NAME` defaults to `MMS`
- `APP_URL` defaults to `http://localhost:8080` and can be a comma-separated list of allowed frontend origins
- `API_URL` defaults to `http://localhost:3001`
- `VITE_API_BASE_URL` sets the frontend API base URL
- `MMS_DATA_DIR` defaults to `./runtime`

Database settings:

- `DATABASE_URL` defaults to `postgresql://postgres:postgres@localhost:5432/mms`
- `MIGRATION_DATABASE_URL` is optional and can point at a separate direct/admin database connection
- `DATABASE_SSL` is optional; when unset, SSL is inferred for Supabase-style connection strings
- `MMS_AUTO_MIGRATE=true` runs migrations on API boot
- `MMS_SEED_ON_BOOT` seeds demo data on boot for local or demo use; set `MMS_SEED_ON_BOOT=false` in production and hosted environments

Supabase settings:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET` defaults to `mms-uploads`

SMS and OTP settings:

- `AFRICAS_TALKING_USERNAME`
- `AFRICAS_TALKING_API_KEY`
- `AFRICAS_TALKING_FROM`
- `AFRICAS_TALKING_USE_SANDBOX` defaults to `false`
- `OTP_TTL_MINUTES` defaults to `10`
- `OTP_REGISTRATION_MESSAGE_TEMPLATE` is optional
- `OTP_LOGIN_MESSAGE_TEMPLATE` is optional

Payments:

- `PESAPAL_CONSUMER_KEY`
- `PESAPAL_CONSUMER_SECRET`
- `PESAPAL_BASE_URL` defaults to the Pesapal sandbox URL
- `PESAPAL_CALLBACK_URL` should point to your frontend callback page such as `https://your-app.vercel.app/payments/callback`
- `PESAPAL_IPN_URL` should point to your API route such as `https://your-api.onrender.com/payments/webhooks/pesapal`
- `PESAPAL_IPN_ID` is required for submit-order requests after registering the IPN URL
- `PESAPAL_USE_IFRAME=true` keeps checkout inside the app with an iframe; `false` uses a full-page redirect
- `PAYMENTS_ENABLED` defaults to `true`
- `PAYMENT_SETTLEMENT_DELAY_MS` still exists in config and `.env.example`, but the current payment flow is webhook-driven and does not use a timer-based settlement worker

Sessions, notifications, fallback simulation:

- `SESSION_TTL_HOURS` defaults to `24`
- `NOTIFICATION_RETRY_COUNT` defaults to `2`
- `MMS_ENABLE_FALLBACK_SIMULATION` defaults to enabled in development and disabled in production unless explicitly set

## Supabase deployment

This repo supports a shared Supabase-backed deployment flow:

1. Use `DATABASE_URL` for the application's normal runtime connection.
2. Use `MIGRATION_DATABASE_URL` for migrations when you want a separate direct connection.
3. Set `DATABASE_SSL=true` for Supabase-hosted PostgreSQL unless your connection string already forces SSL.
4. Add your Supabase project settings:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=sb_publishable_or_anon_key
SUPABASE_SERVICE_ROLE_KEY=sb_service_role_key
SUPABASE_STORAGE_BUCKET=mms-uploads
```

5. Disable boot seeding in hosted environments with `MMS_SEED_ON_BOOT=false`.
6. Run migrations explicitly:

```bash
npm run db:migrate
```

7. Seed only when you want demo data in a local or staging demo environment:

```bash
npm run db:seed
```

Notes:

- Uploads go to Supabase Storage when the required env vars are present and fall back to `runtime/uploads/` otherwise.
- Seed data syncs demo users into Supabase Auth when Supabase Auth is configured, so it should remain disabled in production.
- Web and mobile clients should use the same backend API so approval, OTP, payment, and audit flows stay centralized.

## Deploy on Vercel + Render + Supabase

This repo is prepared for a split deployment:

- Vercel hosts the frontend
- Render hosts the long-running Node API
- Supabase provides PostgreSQL, optional Auth, and optional Storage

### Render API

The API can be deployed to Render using the included `render.yaml`.

Recommended Render environment values:

- `APP_ENV=production`
- `APP_URL=https://your-app.vercel.app` or a comma-separated list of frontend origins
- `API_URL=https://your-api.onrender.com`
- `DATABASE_URL` set to your runtime PostgreSQL connection string
- `MIGRATION_DATABASE_URL` set to your direct migration connection string when available
- `DATABASE_SSL=true`
- `MMS_AUTO_MIGRATE=false`
- `MMS_SEED_ON_BOOT=false`
- `SUPABASE_URL=https://your-project.supabase.co`
- `SUPABASE_ANON_KEY=sb_publishable_...`
- `SUPABASE_SERVICE_ROLE_KEY=sb_secret_...`
- `SUPABASE_STORAGE_BUCKET=mms-uploads`
- `AFRICAS_TALKING_USERNAME=your_app_username` or `sandbox`
- `AFRICAS_TALKING_API_KEY=your_api_key`
- `AFRICAS_TALKING_FROM=your_sender_id_or_number`
- `AFRICAS_TALKING_USE_SANDBOX=false` for live delivery
- `PESAPAL_CONSUMER_KEY=...`
- `PESAPAL_CONSUMER_SECRET=...`
- `PESAPAL_BASE_URL=https://cybqa.pesapal.com/pesapalv3` for sandbox testing
- `PESAPAL_CALLBACK_URL=https://your-app.vercel.app/payments/callback`
- `PESAPAL_IPN_URL=https://your-api.onrender.com/payments/webhooks/pesapal`
- `PESAPAL_IPN_ID=...`
- `PESAPAL_USE_IFRAME=true`
- `PAYMENTS_ENABLED=true`

Notes:

- Render's `PORT` env is respected automatically.
- Health checks use `/health`.
- Automatic boot seeding should stay disabled in hosted environments.
- For hosted team testing, keep Pesapal on sandbox until you are ready for a real production cutover.
- Register the sandbox Pesapal IPN URL with `npm run pesapal:register-ipn` and store the returned `ipn_id` in `PESAPAL_IPN_ID` before enabling checkout.
- Switch to the live Pesapal base URL only when you also replace the sandbox credentials and sandbox IPN ID.

### Vercel frontend

Deploy the repo root to Vercel as a Vite project. The included `vercel.json` adds SPA rewrites so React Router routes resolve correctly on refresh.

Set this Vercel environment variable:

- `VITE_API_BASE_URL=https://your-api.onrender.com`

If you use a custom frontend domain, add that domain to Render's `APP_URL` list so the API allows it through CORS.

## Notes

- Database schema changes live in `server/db/migrations/`
- Background notification delivery is handled by `processNotificationDeliveries`
- Payment completion comes from Pesapal callback/IPN processing plus an explicit transaction-status check, not from a mock settlement loop
- Fallback USSD/SMS routes are disabled unless fallback simulation is enabled
- Managers, officials, and admins can send coordination messages; officials and admins can review resource requests
