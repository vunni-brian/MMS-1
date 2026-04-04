# Market Management System

Market Management System is now a full-stack MVP in a single repo:

- `src/` contains the Vite + React frontend
- `server/` contains a modular TypeScript API using Node's built-in HTTP runtime and PostgreSQL
- `runtime/` is created locally for fallback uploads and other runtime artifacts

## What is implemented

- Vendor registration with ID upload, OTP verification, and manager approval
- Credential login with privileged-role MFA for managers and officials
- Role-based access control for vendor, manager, and official users
- Stall publishing, reservation, payment status progression, and booking confirmation
- Payment initiation with sandbox-style MTN/Airtel adapters and webhook endpoint
- Notification history plus background SMS/email delivery simulation
- Complaint/ticket workflow with manager updates
- Revenue, dues, and audit reporting
- USSD/SMS fallback query handlers
- Multi-market oversight with market-scoped managers, vendors, stalls, and reports

## Run locally

Install dependencies if they are not already present, then use two terminals:

```bash
npm run dev:web
```

```bash
npm run dev:api
```

The frontend runs on `http://localhost:8080`.
The API runs on `http://localhost:3001`.

Before starting the API, point `DATABASE_URL` at a reachable PostgreSQL database and run the migrations:

```bash
npm run db:migrate
```

For a one-off API start without watch mode:

```bash
npm run api
```

## Verification

```bash
npm run lint
npm run build
```

## Seed accounts

- Vendor: `+256700100200` / `Vendor123!`
- Vendor (pending approval): `+256770200300` / `Vendor123!`
- Vendor: `+256780300400` / `Vendor123!`
- Vendor (Jinja): `+256702800900` / `Vendor123!`
- Manager: `+256700500600` / `Manager123!`
- Manager (Jinja): `+256703700800` / `Manager123!`
- Official: `+256700600700` / `Official123!`

Privileged-role MFA and vendor registration OTP return a `developmentCode` in API responses while `NODE_ENV` is not `production`.

## Environment

Optional environment variables:

- `API_PORT` default `3001`
- `APP_URL` default `http://localhost:8080` and may be a comma-separated list of allowed frontend origins
- `API_URL` default `http://localhost:3001`
- `VITE_API_BASE_URL` frontend API base URL for the Vite app
- `MMS_DATA_DIR` default `./runtime`
- `DATABASE_URL` default `postgresql://postgres:postgres@localhost:5432/mms`
- `MIGRATION_DATABASE_URL` optional direct/admin connection string for migrations
- `DATABASE_SSL` default `false`
- `MMS_AUTO_MIGRATE` default `true`
- `MMS_SEED_ON_BOOT` default `true` in development and `false` in production
- `SUPABASE_URL` optional project URL for Supabase Auth and Storage
- `SUPABASE_ANON_KEY` optional publishable/anon key used by the API to validate phone-password sign-ins against Supabase Auth
- `SUPABASE_SERVICE_ROLE_KEY` optional service role key used by the API for Auth user provisioning and Storage uploads
- `SUPABASE_STORAGE_BUCKET` default `mms-uploads`
- `OTP_TTL_MINUTES` default `10`
- `SESSION_TTL_HOURS` default `24`
- `NOTIFICATION_RETRY_COUNT` default `2`
- `PAYMENT_SETTLEMENT_DELAY_MS` default `5000`

## Supabase deployment

This repo is now set up for a shared Supabase-backed deployment flow:

1. Use `DATABASE_URL` for the application's normal runtime connection.
2. Use `MIGRATION_DATABASE_URL` for migration and admin tasks when you want a separate direct connection.
3. Set `DATABASE_SSL=true` for Supabase.
4. Add your Supabase project settings:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=sb_publishable_or_anon_key
SUPABASE_SERVICE_ROLE_KEY=sb_service_role_key
SUPABASE_STORAGE_BUCKET=mms-uploads
```

5. Disable automatic boot seeding in hosted environments with `MMS_SEED_ON_BOOT=false`.
6. Run migrations explicitly:

```bash
npm run db:migrate
```

7. Seed only when you actually want demo data:

```bash
npm run db:seed
```

Suggested Supabase setup:

- For long-running backend servers, use the Supabase direct connection string or a session pooler connection for `DATABASE_URL`.
- For migrations, prefer `MIGRATION_DATABASE_URL` with a direct connection string when available.
- Turn on Phone auth in Supabase if you want to keep the current phone-number login UX.
- The API now stores uploads in Supabase Storage when the Supabase env vars are present, and falls back to `runtime/uploads/` only when they are not.
- Seed data will sync the demo users into Supabase Auth when Supabase is configured, so the seeded credentials keep working through the same API.
- Web and mobile clients should share this same backend API so vendor approval, OTP checks, and privileged MFA stay centralized in one place.

## Deploy on Vercel + Render + Supabase

This repo is prepared for a split deployment:

- Vercel hosts the Vite frontend
- Render hosts the Node API
- Supabase provides PostgreSQL, Auth, and Storage

### Render API

The API is a long-running Node server and should be deployed to Render using the included `render.yaml`.

Recommended Render environment values:

- `APP_URL=https://your-app.vercel.app` or a comma-separated list such as `https://your-app.vercel.app,https://your-custom-domain.com`
- `API_URL=https://your-api.onrender.com`
- `DATABASE_URL` set to your Supabase pooler connection string
- `MIGRATION_DATABASE_URL` set to your Supabase direct migration connection string
- `DATABASE_SSL=true`
- `MMS_AUTO_MIGRATE=true`
- `MMS_SEED_ON_BOOT=false`
- `SUPABASE_URL=https://your-project.supabase.co`
- `SUPABASE_ANON_KEY=sb_publishable_...`
- `SUPABASE_SERVICE_ROLE_KEY=sb_secret_...`
- `SUPABASE_STORAGE_BUCKET=mms-uploads`

Notes:

- The API now respects Render's `PORT` env automatically.
- Health checks use `/health`.
- Automatic boot seeding should stay disabled in hosted environments.

### Vercel frontend

Deploy the repo root to Vercel as a Vite project. The included `vercel.json` adds SPA rewrites so React Router routes resolve correctly on refresh.

Set this Vercel environment variable:

- `VITE_API_BASE_URL=https://your-api.onrender.com`

If you use a custom frontend domain, add that domain to Render's `APP_URL` list so the API allows it through CORS.

## Notes

- File uploads use Supabase Storage when configured, otherwise they fall back to `runtime/uploads/`
- Database schema changes live in `server/db/migrations/`
- Notification delivery is simulated through the outbox worker and console logging
- Payment settlement is simulated in the background worker unless a provider webhook is posted explicitly
- Officials can review resource requests and send coordination messages, but they do not mutate core vendor, stall, booking, or payment records
