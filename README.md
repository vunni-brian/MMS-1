# Market Stall Manager

Market Stall Manager is now a full-stack MVP in a single repo:

- `src/` contains the Vite + React frontend
- `server/` contains a modular TypeScript API using Node's built-in HTTP runtime and SQLite
- `runtime/` is created locally for the SQLite database and uploaded files

## What is implemented

- Vendor registration with ID upload, OTP verification, and manager approval
- Credential login with manager MFA
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

Manager MFA and vendor registration OTP return a `developmentCode` in API responses while `NODE_ENV` is not `production`.

## Environment

Optional environment variables:

- `API_PORT` default `3001`
- `APP_URL` default `http://localhost:8080`
- `API_URL` default `http://localhost:3001`
- `MMS_DATA_DIR` default `./runtime`
- `MMS_DB_PATH` default `./runtime/mms.sqlite`
- `OTP_TTL_MINUTES` default `10`
- `SESSION_TTL_HOURS` default `24`
- `NOTIFICATION_RETRY_COUNT` default `2`
- `PAYMENT_SETTLEMENT_DELAY_MS` default `5000`

## Notes

- File uploads are stored locally under `runtime/uploads/`
- Notification delivery is simulated through the outbox worker and console logging
- Payment settlement is simulated in the background worker unless a provider webhook is posted explicitly
- Officials can review resource requests and send coordination messages, but they do not mutate core vendor, stall, booking, or payment records
