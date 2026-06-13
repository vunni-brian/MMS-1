# Market Management System (MMS) - Architecture Diagram

## System Overview

MMS is a full-stack market operations platform for municipal and private market administration. It supports vendor onboarding, stall allocation, billing, payment tracking, complaints, official oversight, reporting, audit trails, and staff administration.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              MARKET MANAGEMENT SYSTEM                              │
│                                                                                   │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                           FRONTEND (React + Vite)                          │  │
│  │                                                                           │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │  │
│  │  │   Public     │  │   Vendor     │  │   Manager    │  │   Official   │  │  │
│  │  │   Routes     │  │   Workspace  │  │   Workspace  │  │   Workspace  │  │  │
│  │  │              │  │              │  │              │  │              │  │  │
│  │  │  • Landing   │  │  • Dashboard │  │  • Dashboard │  │  • Dashboard │  │  │
│  │  │  • Login     │  │  • Stalls    │  │  • Vendors   │  │  • Reports    │  │  │
│  │  │  • Register  │  │  • Payments  │  │  • Stalls    │  │  • Billing    │  │  │
│  │  │  • Callback  │  │  • Complaints│  │  • Payments  │  │  • Audit      │  │  │
│  │  │              │  │  • Profile   │  │  • Complaints│  │  • Coordination│ │  │
│  │  │              │  │              │  │  • Billing    │  │              │  │  │
│  │  │              │  │              │  │  • Reports    │  │              │  │  │
│  │  │              │  │              │  │  • Audit      │  │              │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  │  │
│  │                                                                           │  │
│  │  ┌─────────────────────────────────────────────────────────────────────┐ │  │
│  │  │                        ADMIN WORKSPACE                               │ │  │
│  │  │  • Dashboard  • Users  • Markets  • Alerts  • Integrations          │ │  │
│  │  └─────────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                           │  │
│  │  ┌─────────────────────────────────────────────────────────────────────┐ │  │
│  │  │                    SHARED COMPONENTS & SERVICES                     │ │  │
│  │  │  • AuthContext  • ProtectedRoute  • AppLayout  • UI Components     │ │  │
│  │  │  • API Client (src/lib/api.ts)  • TanStack Query Cache              │ │  │
│  │  └─────────────────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────────┘
│                                        │
│                                        │ HTTP (Bearer Token)
│                                        ▼
│  ┌───────────────────────────────────────────────────────────────────────────┐
│  │                         BACKEND API (Node.js + TypeScript)                │
│  │                                                                           │  │
│  │  ┌─────────────────────────────────────────────────────────────────────┐ │  │
│  │  │                    CUSTOM HTTP SERVER (server/main.ts)                │ │  │
│  │  │  • Route Matcher  • CORS Handler  • Auth Middleware  • Error Handler │ │  │
│  │  └─────────────────────────────────────────────────────────────────────┘ │  │
│  │                                        │                                    │  │
│  │  ┌─────────────────────────────────────────────────────────────────────┐ │  │
│  │  │                        ROUTE MODULES                                 │ │  │
│  │  │                                                                       │ │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │ │  │
│  │  │  │  auth.ts │ │vendors.ts│ │stalls.ts │ │payments  │ │tickets.ts│  │ │  │
│  │  │  └──────────┘ └──────────┘ └──────────┘ │.ts       │ └──────────┘  │ │  │
│  │  │                                        └──────────┘                 │ │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │ │  │
│  │  │  │billing.ts│ │utilities │ │penalties │ │reports.ts│ │coord-    │  │ │  │
│  │  │  │          │ │.ts       │ │.ts       │ │          │ │ination.ts│  │ │  │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │ │  │
│  │  │                                                                       │ │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │ │  │
│  │  │  │markets.ts│ │notif-    │ │resources │ │announce- │              │ │  │
│  │  │  │          │ │ications  │ │.ts       │ │ments.ts  │              │ │  │
│  │  │  │          │ │.ts       │ │          │ │          │              │ │  │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘              │ │  │
│  │  └─────────────────────────────────────────────────────────────────────┘ │  │
│  │                                        │                                    │  │
│  │  ┌─────────────────────────────────────────────────────────────────────┐ │  │
│  │  │                        SHARED LIBRARIES (server/lib/)                 │ │  │
│  │  │                                                                       │ │  │
│  │  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │ │  │
│  │  │  │  db.ts       │ │  session.ts  │ │  security.ts │ │ permissions  │ │ │  │
│  │  │  │  (PostgreSQL)│ │  (Auth)      │ │  (Hashing)   │ │  .ts         │ │ │  │
│  │  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ │ │  │
│  │  │                                                                       │ │  │
│  │  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │ │  │
│  │  │  │  pesapal.ts  │ │  sms.ts      │ │  storage.ts  │ │  validation  │ │ │  │
│  │  │  │  (Payments)  │ │  (Africa's   │ │  (Files)     │ │  .ts         │ │ │  │
│  │  │  │              │ │   Talking)   │ │              │ │              │ │ │  │
│  │  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ │ │  │
│  │  │                                                                       │ │  │
│  │  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                  │ │  │
│  │  │  │  http.ts     │ │  logger.ts   │ │  rate-limit  │ │                  │ │  │
│  │  │  │  (Helpers)   │ │              │ │  .ts         │ │                  │ │  │
│  │  │  └──────────────┘ └──────────────┘ └──────────────┘ │                  │ │  │
│  │  └─────────────────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────────┘
│                                        │
│                                        │ SQL
│                                        ▼
│  ┌───────────────────────────────────────────────────────────────────────────┐
│  │                          POSTGRESQL DATABASE                               │
│  │                                                                           │  │
│  │  ┌─────────────────────────────────────────────────────────────────────┐ │  │
│  │  │                        CORE TABLES                                    │ │  │
│  │  │                                                                       │ │  │
│  │  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │ │  │
│  │  │  │  users       │ │  sessions    │ │  markets     │ │  locations   │ │ │  │
│  │  │  │  (All users)│ │  (Auth)      │ │              │ │  (Hierarchy) │ │ │  │
│  │  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ │ │  │
│  │  │                                                                       │ │  │
│  │  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │ │  │
│  │  │  │  staff_      │ │  vendor_     │ │  stalls      │ │  bookings    │ │ │  │
│  │  │  │  profiles    │ │  profiles    │ │              │ │              │ │ │  │
│  │  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ │ │  │
│  │  │                                                                       │ │  │
│  │  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │ │  │
│  │  │  │  payments    │ │  utility_    │ │  penalties   │ │  charge_     │ │ │  │
│  │  │  │              │ │  charges     │ │              │ │  types       │ │ │  │
│  │  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ │ │  │
│  │  │                                                                       │ │  │
│  │  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │ │  │
│  │  │  │  tickets     │ │  ticket_     │ │  notifications│ │  coord-      │ │ │  │
│  │  │  │              │ │  updates     │ │              │ │  ination_    │ │ │  │
│  │  │  │              │ │              │ │              │ │  messages    │ │ │  │
│  │  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ │ │  │
│  │  │                                                                       │ │  │
│  │  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                  │ │  │
│  │  │  │  resource_   │ │  announce-   │ │  audit_      │ │                  │ │  │
│  │  │  │  requests    │ │  ments       │ │  events      │ │                  │ │  │
│  │  │  └──────────────┘ └──────────────┘ └──────────────┘ │                  │ │  │
│  │  └─────────────────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────────┘
│                                        │
│                                        ▼
│  ┌───────────────────────────────────────────────────────────────────────────┐
│  │                          EXTERNAL INTEGRATIONS                             │
│  │                                                                           │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │  │
│  │  │  Pesapal     │ │  Africa's    │ │  Supabase    │ │  File System │      │  │
│  │  │  (Payments)  │ │  Talking SMS │ │  (Optional   │ │  (runtime/   │      │  │
│  │  │              │ │              │ │   Storage)   │ │   uploads)   │      │  │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘      │  │
│  └───────────────────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Request Flow

```
User Action (Browser)
    ↓
Frontend Component (React)
    ↓
API Client (src/lib/api.ts)
    ↓
HTTP Request with Bearer Token
    ↓
Custom HTTP Server (server/main.ts)
    ↓
Route Matcher → Route Handler (server/modules/*.ts)
    ↓
Authentication Check (server/lib/session.ts)
    ↓
Permission Check (server/lib/permissions.ts)
    ↓
Database Query (server/lib/db.ts)
    ↓
PostgreSQL Database
    ↓
Response (JSON)
    ↓
TanStack Query Cache Update
    ↓
UI Re-render
```

## Authentication Flow

```
1. Vendor Registration
   ┌─────────┐
   │ Register│
   │ Form    │
   └────┬────┘
        │ Submit (files as base64)
        ↓
   ┌──────────────┐
   │ POST /auth/  │
   │ register-    │
   │ vendor       │
   └──────┬───────┘
          │ Create OTP challenge
          │ Store registration data
          ↓
   ┌──────────────┐
   │ Send OTP SMS  │
   │ (Africa's    │
   │  Talking)    │
   └──────┬───────┘
          │
   ┌──────▼───────┐
   │ Enter OTP    │
   └──────┬───────┘
          │ Verify OTP
          ↓
   ┌──────────────┐
   │ POST /auth/  │
   │ verify-      │
   │ registration-│
   │ otp          │
   └──────┬───────┘
          │ Create user
          │ Create vendor_profile
          │ Store documents
          │ Return session token
          ↓
   ┌──────────────┐
   │ Pending      │
   │ Approval     │
   └──────────────┘

2. Staff Login (with MFA)
   ┌─────────┐
   │ Login   │
   │ Form    │
   └────┬────┘
        │ POST /auth/login
        ↓
   ┌──────────────┐
   │ Verify       │
   │ Password     │
   └──────┬───────┘
          │ If privileged role
          ↓
   ┌──────────────┐
   │ Create MFA   │
   │ Challenge    │
   └──────┬───────┘
          │
   ┌──────▼───────┐
   │ Enter MFA    │
   │ Code         │
   └──────┬───────┘
          │ POST /auth/verify-privileged-mfa
          ↓
   ┌──────────────┐
   │ Return       │
   │ Session Token│
   └──────────────┘
```

## Key Workflows

### 1. Stall Booking Workflow
```
Vendor → Browse Stalls → Reserve Stall → Manager Review → Approve/Reject
                                                      ↓
                                                Mark Paid → Confirm
```

### 2. Payment Workflow
```
Initiate Payment → Pesapal Gateway (or Manual Receipt)
        ↓
Payment Callback/IPN → Update Payment Status
        ↓
Mark Booking/Charge as Paid
```

### 3. Complaint/Ticket Workflow
```
Vendor Creates Ticket → Manager Reviews → Add Comments
                                    ↓
                              Resolve or Escalate
                                    ↓
                            Official Oversight
```

### 4. Notification Delivery
```
Event Occurs → Create Notification → Background Task (every 2s)
                                          ↓
                                  Process Deliveries
                                          ↓
                            In-App + SMS (if configured)
```

## Technology Stack

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Language**: TypeScript
- **Routing**: React Router DOM
- **State Management**: TanStack Query (React Query)
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts
- **Animations**: Framer Motion

### Backend
- **Runtime**: Node.js 22
- **Language**: TypeScript (executed with --experimental-strip-types)
- **Server**: Custom HTTP server (node:http)
- **Database**: PostgreSQL (pg library)
- **Authentication**: Bearer token sessions
- **Password Hashing**: bcrypt
- **File Storage**: Local filesystem (runtime/uploads) or Supabase Storage
- **Payment Gateway**: Pesapal
- **SMS**: Africa's Talking
- **Migrations**: Custom SQL migration runner

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Deployment**: Render (API) + Vercel (Frontend)
- **Monitoring**: Prometheus + Grafana (optional)
- **Database**: PostgreSQL 16

## Directory Structure

```
MMS-1/
├── src/                          # Frontend React application
│   ├── components/              # React components
│   │   ├── ui/                 # shadcn/ui primitives
│   │   ├── auth/               # Auth-related components
│   │   └── console/            # Console-specific components
│   ├── pages/                   # Route pages
│   │   ├── vendor/            # Vendor workspace
│   │   ├── manager/           # Manager workspace
│   │   ├── official/          # Official workspace
│   │   ├── admin/             # Admin workspace
│   │   └── shared/            # Shared pages
│   ├── contexts/               # React contexts (AuthContext)
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Utilities (API client)
│   ├── config/                 # Frontend configuration
│   └── types/                  # TypeScript types
├── server/                      # Backend API
│   ├── modules/                # API route handlers
│   │   ├── auth.ts            # Authentication
│   │   ├── vendors.ts         # Vendor management
│   │   ├── stalls.ts          # Stall management
│   │   ├── payments.ts        # Payment processing
│   │   ├── tickets.ts         # Complaint management
│   │   ├── reports.ts         # Reporting
│   │   └── ...               # Other modules
│   ├── lib/                    # Shared backend services
│   │   ├── db.ts              # Database layer
│   │   ├── session.ts         # Authentication
│   │   ├── permissions.ts     # Authorization
│   │   ├── pesapal.ts         # Payment integration
│   │   ├── sms.ts             # SMS integration
│   │   ├── storage.ts         # File storage
│   │   └── ...               # Other utilities
│   ├── db/                     # Database
│   │   ├── migrations/        # SQL migrations
│   │   ├── migrate.ts         # Migration runner
│   │   └── seed.ts            # Seed data
│   ├── main.ts                 # API server entry point
│   ├── config.ts               # Environment configuration
│   └── types.ts                # Backend types
├── public/                      # Static assets
├── runtime/                     # Runtime data (uploads, etc.)
├── docs/                        # Documentation
├── infra/                       # Infrastructure (Terraform, monitoring)
├── scripts/                     # Operational scripts
├── docker-compose.yml           # Local development stack
├── Dockerfile                   # Production API image
├── openapi.yaml                 # API specification
└── package.json                 # Dependencies and scripts
```

## Security Model

1. **Authentication**: Bearer token sessions stored in PostgreSQL
2. **Authorization**: Role-based permissions (vendor, manager, official, admin)
3. **Password Security**: Hashed with bcrypt before storage
4. **Session Management**: Configurable TTL with automatic expiry
5. **MFA**: Optional for privileged roles (manager, official, admin)
6. **CORS**: Restricted to configured APP_URL origins
7. **Vendor Approval**: Vendors blocked from sensitive actions until approved
8. **File Security**: Files served through authenticated endpoints, not public paths
9. **Audit Trail**: All important actions logged to audit_events table
10. **Rate Limiting**: Configurable rate limiting per endpoint

## Background Tasks

The API runs a background notification delivery loop every 2 seconds:

```typescript
setInterval(() => {
  runBackgroundTask("notifications", processNotificationDeliveries);
}, 2_000);
```

This task:
- Processes pending notification deliveries
- Retries failed deliveries according to NOTIFICATION_RETRY_COUNT
- Handles in-app notifications and SMS delivery
- Implements exponential backoff for failures

## Database Schema Highlights

Key tables and their relationships:

- **users**: All user accounts (vendors, staff)
- **staff_profiles**: Manager/official/admin metadata
- **vendor_profiles**: Vendor-specific data, approval status, documents
- **sessions**: Active bearer token sessions
- **otp_challenges**: Registration and MFA OTP challenges
- **markets**: Market records
- **locations**: Location hierarchy (regions, cities, districts, divisions, markets)
- **stalls**: Market stalls with pricing and availability
- **bookings**: Stall reservation workflow
- **payments**: Payment records (booking, utility, penalty)
- **payment_attempts**: Gateway or manual payment attempts
- **utility_charges**: Water, power, waste bills
- **penalties**: Compliance or late payment penalties
- **charge_types**: Billing toggle controls
- **tickets**: Complaints with lifecycle management
- **ticket_updates**: Status/comment history
- **notifications**: User-facing notifications
- **notification_deliveries**: Channel delivery attempts
- **coordination_messages**: Manager/official coordination
- **resource_requests**: Manager resource requests
- **audit_events**: Operational audit trail
- **announcements**: System-wide announcements

## Environment Configuration

Key environment variables:

- **API_PORT**: Backend HTTP port (default: 3001)
- **DATABASE_URL**: PostgreSQL connection string
- **APP_URL**: Allowed frontend origins (CORS)
- **VITE_API_BASE_URL**: Frontend API base URL
- **SESSION_TTL_HOURS**: Session expiry
- **OTP_TTL_MINUTES**: OTP expiry
- **PESAPAL_***: Payment gateway configuration
- **AFRICAS_TALKING_***: SMS configuration
- **SUPABASE_***: Optional Supabase storage
- **MMS_AUTO_MIGRATE**: Run migrations on boot
- **MMS_SEED_ON_BOOT**: Seed data on boot

## Development Workflow

1. **Start PostgreSQL**: `docker compose up -d postgres`
2. **Run migrations**: `npm run db:migrate`
3. **Seed data**: `npm run db:seed`
4. **Start API**: `npm run dev:api` (port 3001)
5. **Start frontend**: `npm run dev:web` (port 5173)
6. **Run tests**: `npm run test`
7. **Lint**: `npm run lint`
8. **Build**: `npm run build`

## Deployment Options

1. **Docker Compose**: Full local stack with monitoring
2. **Render**: Hosted API deployment
3. **Vercel**: Frontend hosting
4. **Production API container**: Docker image deployment

## Key Features by Role

### Vendor
- Self-service registration with document upload
- Stall browsing and reservation
- Payment initiation (Pesapal or manual receipt)
- Complaint submission and tracking
- Profile management
- Notification viewing

### Manager
- Vendor approval/rejection
- Stall creation and management
- Booking review and approval
- Utility charge creation
- Penalty management
- Complaint resolution
- Market-level reporting
- Coordination messaging
- Resource requests

### Official
- Cross-market oversight
- Financial and operational reports
- Compliance monitoring
- Resource request review
- Audit trail access
- Coordination messaging

### Admin
- Staff user management
- Role and permission configuration
- System-level reporting
- Billing control configuration
- Market management
- Integration settings
- Audit oversight
