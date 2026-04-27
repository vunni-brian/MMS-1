# Market Management System

Market Management System (`MMS`) is a full-stack market operations platform designed for vendors, managers, officials, and administrators.

Current release: `1.0.0`  

---

## Repository structure

- `src/` – Vite + React frontend
- `server/` – TypeScript backend (Node HTTP server)
- `runtime/` – local uploads and runtime artifacts

---

## System overview

MMS is a **role-based operations console** for managing:

- vendor onboarding
- stall allocation
- payments & billing
- compliance & oversight
- audit & reporting

---

## Roles
##Demo accounts for testing
Admin: +256701111222 / Admin123!
Official: +256700600700 / Official123!
Manager: +256700500600 / Manager123!
Vendor: +256700100200 / Vendor123!

### Vendor
- register with OTP + documents
- view available stalls
- apply for stalls
- make payments
- track complaints
- manage profile

### Manager
- approve/reject vendors
- manage stalls
- monitor payments
- handle complaints
- view reports

### Official
- regional oversight
- monitor compliance
- track financial health
- drill-down:

### Admin
- full system control
- billing governance
- audit logs
- system alerts
- user & market overview

---

## Key Features

### Vendor onboarding
- OTP verification
- Profile photo
- NIN / ID number
- District
- Product section
- National ID upload
- LC Letter upload
- Manager approval workflow

---

### Stall marketplace
- visual stall cards
- availability tracking
- vendor applications
- reservation workflow

---

### Payments (Pesapal)
- checkout (iframe or redirect)
- callback + IPN verification
- transaction validation
- receipt generation
- payment status tracking

---

### Billing system
- centralized charge control:
- market dues
- utilities
- penalties
- booking fees
- payment gateway
- enable/disable per charge type
- vendor actions blocked when disabled

---

### Complaints system
- ticket creation
- categories & priority
- progress tracking
- attachments
- manager resolution workflow

---

### Official oversight
- region-based access (scoped)
- no cross-region visibility
- regional dashboards
- compliance tracking
- financial summaries

---

### Admin command center
- system KPIs
- market performance
- user & role monitoring
- payment insights
- system alerts
- audit logs

---

### Audit system
- full activity tracking
- filterable logs
- evidence view
- CSV export

---

## UI design system

The interface uses a **console-based design pattern**:

- page headers (role + scope)
- KPI strips
- dense tables
- detail drawers
- compact cards
- status badges
- minimal color usage

### Color meaning
- Green → success / active
- Orange → pending / attention
- Red → failure / critical
- Blue → informational (rare)

---

## Tech stack

### Frontend
- React 18
- Vite
- TypeScript
- TanStack Query
- Tailwind CSS
- shadcn/ui

### Backend
- Node 22
- TypeScript
- PostgreSQL (`pg`)
- custom HTTP routing

### Integrations
- Pesapal (payments)
- Africa’s Talking (SMS)
- Supabase (optional auth/storage)
- Vercel (frontend)
- Render (API)

---

## Run locally

### Requirements
- Node 22+
- PostgreSQL
- npm

### Setup

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev:api
npm run dev:web