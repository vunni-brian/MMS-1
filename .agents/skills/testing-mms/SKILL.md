---
name: testing-mms
description: Set up and end-to-end test the MMS app locally (frontend, API, Postgres). Use when verifying MMS UI or API changes.
---

# Testing MMS locally

## Setup
1. `npm install`
2. `cp .env.example .env` (defaults work for local)
3. `docker compose up -d postgres` (container `mms-postgres`, db `mms`, user/pass `postgres`/`postgres`)
4. Wait a few seconds for Postgres to accept connections, then `npm run db:migrate` and `npm run db:seed`. If migrate fails with a "constraint already exists" error, the DB may be in a partial state — drop and recreate: `docker exec mms-postgres psql -U postgres -c "DROP DATABASE mms WITH (FORCE);"` then `CREATE DATABASE mms;` and re-run migrate/seed.
5. `npm run dev:api` (API on http://localhost:3001) and `npm run dev:web` (Vite on http://localhost:8080 — NOT 5173 despite README).

## Demo accounts (seeded)
- Admin: `+256701111222` / `Admin123!` (MFA required)
- Official: `+256700600700` / `Official123!`
- Manager: `+256700500600` / `Manager123!`
- Vendor: `+256700100200` / `Vendor123!`

## MFA / OTP during login
Privileged logins trigger an OTP. In local dev the SMS falls back to the API console: look for `[delivery:sms:fallback] +2567... Your secure login code is XXXXXX` in the dev:api output. OTP codes in the DB are hashed (`otp_challenges.code_hash`), so the log is the only easy source.

## API routes
Routes are NOT prefixed with `/api` — e.g. `GET http://localhost:3001/markets`. Unknown paths return `{"error":"Route not found."}`.

## Quality checks
- `npm run lint` (eslint), `npm test` (vitest), `npm run build` (vite)

## DB-resilience testing tips
- A fresh API boot with Postgres down should log `[startup] Skipping database migration/seed because PostgreSQL is unavailable` and serve `503 Database unavailable` on DB-backed routes.
- Caution: stopping Postgres while the API is RUNNING may crash the process via an unhandled pg pool 'error' event (no `db.on("error")` handler as of mid-2026). If the API stops responding after a DB stop, check for a `node --watch` parent still holding the port and kill it before restarting.
- Killing/restarting the API invalidates browser sessions ("Unable to restore session") — re-login is required.

## Devin Secrets Needed
None — all credentials are local seeded demo accounts.
