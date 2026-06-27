/**
 * Generate MMS Technical Stack, APIs, and Panel Q&A .docx
 *
 * Usage: node --experimental-strip-types scripts/generate-mms-tech-qa-docx.ts
 *
 * Produces docs/MMS-Technical-Stack-APIs-Panel-QA.docx
 */

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
  PageNumber, Footer, Header,
} from "docx";
import fs from "node:fs";

const TEMP_DIR = "C:\\Users\\ousam\\AppData\\Local\\Temp\\opencode";
const OUTPUT = "docs/MMS-Technical-Stack-APIs-Panel-QA.docx";

// Ensure temp dir exists
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// ── Helpers ──────────────────────────────────────────────────────────
const heading = (text: string, level: HeadingLevel) =>
  new Paragraph({
    heading: level,
    spacing: { before: level === HeadingLevel.HEADING_1 ? 320 : 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: level === HeadingLevel.HEADING_1 ? 32 : level === HeadingLevel.HEADING_2 ? 26 : 22 })],
  });

const para = (text: string, opts?: { bold?: boolean; italic?: boolean; size?: number }) =>
  new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, ...opts })],
  });

const bullet = (text: string, level = 0) =>
  new Paragraph({
    spacing: { after: 60 },
    bullet: { level },
    children: [new TextRun({ text })],
  });

const bold = (text: string) => new TextRun({ text, bold: true });
const normal = (text: string) => new TextRun({ text });

const qa = (q: string, a: string[]) => [
  new Paragraph({ spacing: { before: 180, after: 60 }, children: [new TextRun({ text: `Q: ${q}`, bold: true, size: 22 })] }),
  ...a.map((t) => new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: t, size: 22 })] })),
];

const cell = (text: string, opts?: { bold?: boolean; shading?: string }) => {
  const children = [new TextRun({ text, bold: opts?.bold ?? false, size: 20 })];
  return new TableCell({
    children: [new Paragraph({ children, spacing: { before: 40, after: 40 } })],
    width: { size: 100, type: WidthType.PERCENTAGE },
    ...(opts?.shading ? { shading: { type: ShadingType.SOLID, color: opts.shading, fill: opts.shading } } : {}),
  });
};

const headerCell = (text: string) => cell(text, { bold: true, shading: "1F2937" });

const dataRow = (cells: string[]) => new TableRow({ children: cells.map((c) => cell(c)) });

const headerRow = (cells: string[]) => new TableRow({ children: cells.map(headerCell) });

// ── Document Sections ───────────────────────────────────────────────
const sections = [
  // ── Cover / Title Page ──────────────────────────────────────────
  {
    children: [
      new Paragraph({ spacing: { before: 4000 }, children: [] }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: "Market Management System (MMS)", bold: true, size: 44, color: "1F2937" })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        children: [new TextRun({ text: "Technical Stack, APIs, and Panel Q&A", bold: true, size: 32, color: "4B5563" })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [new TextRun({ text: "Market Operations & Administration Platform", size: 24, color: "6B7280" })],
      }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1200 }, children: [new TextRun({ text: "Final Year Project - June 2026", size: 24, color: "9CA3AF" })] }),
    ],
  },

  // ── Table of Contents ───────────────────────────────────────────
  {
    children: [
      heading("TABLE OF CONTENTS", HeadingLevel.HEADING_1),
      para("1. System Architecture"),
      para("2. Technology Stack"),
      para("3. Authentication and Security"),
      para("4. REST API Overview"),
      para("  4.1 How Key APIs Work (Step by Step)"),
      para("5. Frontend and User Experience"),
      para("6. Database and Data Flow"),
      para("7. Deployment and Operations"),
      para("8. Frequently Asked Panel Questions (Quick Answers) — 18 questions"),
      para("9. Auth Endpoint Reference (15 endpoints)"),
      para("10. Document References"),
    ],
  },

  // ── Purpose ─────────────────────────────────────────────────────
  {
    children: [
      heading("Purpose of This Document", HeadingLevel.HEADING_1),
      para("This document answers the technical questions examiners, supervisors, and panel members most often ask during MMS demonstrations and viva sessions. Each section follows a question-and-answer format. Answers are grounded in the implemented codebase (Node.js/TypeScript custom HTTP backend, React/Vite PWA frontend, PostgreSQL database) rather than planned features that are not yet built."),
    ],
  },

  // ── 1. System Architecture ──────────────────────────────────────
  {
    children: [
      heading("1. System Architecture", HeadingLevel.HEADING_1),

      ...qa("What is the overall architecture of MMS?",
        ["MMS uses a three-tier web architecture:",
         "Presentation tier — a React single-page application (Vite, TypeScript, Tailwind CSS, shadcn/ui components, TanStack Query for server-state management).",
         "Application tier — a custom Node.js HTTP server built with native node:http, exposing RESTful JSON endpoints under /auth/*, /vendors/*, /stalls/*, /payments/*, /tickets/*, and other domain routes.",
         "Data tier — PostgreSQL 16 with 30+ tables for markets, users, vendors, stalls, bookings, payments, utility charges, penalties, tickets, notifications, audit trails, and more.",
         "The frontend calls the API over HTTP with Bearer session tokens. Background tasks (notification delivery every 2 s, audit log cleanup every 1 h) run inside the API process."]
      ),

      ...qa("How do the frontend and backend communicate?",
        ["The vendor, manager, official, and admin workspaces are single-page React views. The typed API client in src/lib/api.ts wraps fetch() calls to VITE_API_BASE_URL (typically http://localhost:3001 locally or the deployed Render URL).",
         "Typical flow: user action → api.payments.getAll() → custom HTTP server → route matcher → module handler → PostgreSQL query → JSON response → TanStack Query cache update → UI re-render.",
         "Failed auth returns 401; the frontend clears the stored session token and redirects to /login."]
      ),

      ...qa("What user roles exist and how are they separated?",
        ["Four primary roles: vendor, manager, official, and admin.",
         "Role is stored on the users table and embedded in the session token payload. The backend uses requireAuth() and requirePermission() middleware to guard routes — for example, POST /stalls requires a manager role with stall:write permission, while POST /auth/staff requires admin with auth:manage permission.",
         "Frontend routes are protected by <ProtectedRoute> components that check role against allowed roles for each route segment. Vendor actions additionally require approval via <VendorApprovalGuard>."]
      ),

      ...qa("Why a custom HTTP server instead of Express?",
        ["The backend uses a custom framework built on Node.js native node:http with a lightweight route matcher supporting :param segments. This keeps the dependency footprint minimal, avoids abstraction overhead, and suits a JSON-first REST API with predictable routing patterns.",
         "Shared concerns such as CORS, security headers, rate limiting, request body parsing, authentication, and error handling are composed as middleware functions in server/main.ts. Route definitions are declared in modules under server/modules/* and assembled into a single route array."]
      ),

      ...qa("What is the request flow through the system?",
        ["Browser UI → src/lib/api.ts (typed API client) → HTTP request with Bearer token → server/main.ts (custom HTTP server) → setCorsHeaders() + setSecurityHeaders() → rateLimitMiddleware() → authenticateToken() → matchRoute() → Route handler (server/modules/*.ts) → Authentication check (requireAuth / requirePermission) → Database queries (server/lib/db.ts) → External integrations (Pesapal, Africa's Talking, Supabase) → JSON response → TanStack Query cache update → UI re-render."]
      ),

      ...qa("How does the system handle errors and exceptions?",
        ["The HttpError class (server/lib/http.ts) carries an HTTP status code and optional details payload, allowing route handlers to throw structured errors that propagate to a central error handler in server/main.ts.",
         "Uncaught exceptions trigger a graceful shutdown via process.on('uncaughtException'), which logs the error, captures it in Sentry, closes the HTTP server, and exits after a 5-second timeout. Unhandled promise rejections are logged and sent to Sentry without crashing the process.",
         "Each route handler is wrapped in try/catch (or uses async error propagation). The error handler sends a consistent JSON error response: { error: string, statusCode: number, details?: unknown }. Background task failures are captured independently via captureBackgroundJobFailure() and do not affect the main request loop."]
      ),

      ...qa("How does the system scale under load?",
        ["MMS is designed as a stateless API behind a reverse proxy — horizontal scaling is achieved by running multiple API instances behind a load balancer. Sessions are stored in PostgreSQL (shared across instances), so any instance can serve any request.",
         "Rate limiting uses in-memory stores (per-instance), so under multi-instance deployment a shared Redis backend would be needed for coordinated rate limiting (Redis is provisioned in docker-compose.yml for this purpose).",
         "The PostgreSQL connection pool (pg.Pool) manages database connections efficiently across concurrent requests. TanStack Query's caching layer reduces redundant API calls from the frontend. Vercel's global CDN distributes frontend assets with edge caching."]
      ),
    ],
  },

  // ── 2. Technology Stack ─────────────────────────────────────────
  {
    children: [
      heading("2. Technology Stack", HeadingLevel.HEADING_1),
      para(""),

      new Table({
        rows: [
          headerRow(["Layer", "Technology", "Role in MMS"]),
          dataRow(["Frontend UI", "React 18, TypeScript 5.8, Vite 7", "Single-page application with fast HMR and lazy-loaded route pages"]),
          dataRow(["UI Components", "shadcn/ui (Radix primitives), Tailwind CSS 3.4", "30+ accessible, reusable primitives; utility-first responsive styling"]),
          dataRow(["State & Data", "TanStack Query 5, React Hook Form + Zod", "Server-state caching, optimistic updates, form validation"]),
          dataRow(["Charts & Animation", "Recharts 2, Framer Motion 12", "Dashboard charts, page transitions, micro-interactions"]),
          dataRow(["Icons", "Lucide React", "Consistent SVG iconography"]),
          dataRow(["i18n", "i18next, react-i18next, browser-language-detector", "English, Swahili, and Luganda locales"]),
          dataRow(["Backend runtime", "Node.js 22, TypeScript (--experimental-strip-types)", "HTTP server, WebSocket host, migration scripts, background tasks"]),
          dataRow(["Backend framework", "Custom HTTP server (node:http)", "Route matching, middleware chain, JSON API"]),
          dataRow(["Database", "PostgreSQL 16", "Relational data with 30+ entities, SQL migrations, custom query helpers"]),
          dataRow(["Auth sessions", "Server-side Bearer tokens (SHA-256 hashed)", "Session stored in sessions table, configurable TTL"]),
          dataRow(["Password hashing", "PBKDF2 + SHA-512, 100 000 iterations", "Salt:hash format, constant-time comparison"]),
          dataRow(["Payment gateway", "Pesapal API", "Order creation, iframe redirect, IPN webhooks, callback handling"]),
          dataRow(["SMS", "Africa's Talking API", "OTP delivery, notification SMS, sandbox mode for dev"]),
          dataRow(["File storage", "Local filesystem + optional Supabase Storage", "Profile images, ID docs, ticket attachments, receipt files"]),
          dataRow(["Monitoring", "Sentry, Prometheus + Grafana (optional)", "Error tracking, metrics collection, dashboards"]),
          dataRow(["Security middleware", "Custom security-headers.ts, rate-limit.ts", "CSP, HSTS, X-Frame-Options, rate limiting (3 tiers)"]),
          dataRow(["Testing", "Vitest, Playwright, Jest (legacy)", "Unit tests (23+ files), E2E tests (auth, landing flows)"]),
          dataRow(["Deployment", "Render (API), Vercel (frontend), Docker Compose", "Hosted API + static frontend; optional full container stack"]),
          dataRow(["Containerisation", "Docker Compose (6 services)", "postgres, redis, api, web, prometheus, grafana"]),
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
      }),
      para(""),

      ...qa("Why Node.js and TypeScript instead of Python/Django or PHP?",
        ["Node.js keeps one language (TypeScript) across frontend and backend, which suits a small agile team and a JSON-first REST API. The custom HTTP server avoids framework overhead while maintaining clean middleware composition.",
         "TypeScript with node --experimental-strip-types provides type safety without a compilation step, streamlining the development loop. The pg driver gives direct SQL access with no ORM overhead for complex reporting queries."]
      ),

      ...qa("Why PostgreSQL instead of MySQL or MongoDB?",
        ["MMS depends on relational integrity: users, vendors, stalls, bookings, payments, tickets, and audit trails form a normalized schema with foreign-key constraints. PostgreSQL's mature SQL support, window functions for reporting, and CTEs for recursive location hierarchies are used extensively.",
         "PostgreSQL also provides the pgcrypto extension for cryptographic operations and strong JSONB support for flexible metadata columns. The 22 migration files evolve the schema from basic tables to enterprise-grade features (SLA tracking, account lockout, manual receipt workflow)."]
      ),

      ...qa("Why a React SPA with TanStack Query instead of a server-rendered framework?",
        ["A React SPA with TanStack Query provides a responsive, app-like experience for vendors, managers, and officials who use MMS on both desktop and mobile browsers. TanStack Query handles caching, background refetching, optimistic updates, and request deduplication.",
         "The trade-off is SEO dependence on the landing page only (which is acceptable for an authenticated operational platform, not a public content site). Vercel hosting provides global CDN distribution for the static assets."]
      ),

      ...qa("How is the frontend build optimised for production?",
        ["The Vite build configuration (vite.config.ts) uses manual chunk splitting via rollupOptions.output.manualChunks to separate vendor dependencies into three chunks: vendor-react (React, React DOM, React Router), vendor-ui (Radix UI, shadcn components), and vendor-data (TanStack Query, Recharts). This enables efficient browser caching.",
         "All page components use React.lazy() with Suspense fallback skeletons, so code is loaded on demand rather than in a single bundle. TypeScript type checking runs separately during CI (tsc --noEmit), keeping the Vite build fast.",
         "Asset hashing ensures cache invalidation on content changes. The public directory serves static assets that are copied verbatim during build. Vite's CSS code splitting extracts Tailwind-generated styles per-entry."]
      ),
    ],
  },

  // ── 3. Authentication and Security ──────────────────────────────
  {
    children: [
      heading("3. Authentication and Security", HeadingLevel.HEADING_1),

      ...qa("How does login and session authentication work?",
        ["POST /auth/login accepts phone and password. The backend normalises the phone to E.164 format, verifies the password against the stored PBKDF2 hash (salt:hash format, 100 000 iterations, SHA-512, constant-time comparison via crypto.timingSafeEqual), and checks account lockout (5 failed attempts = 15 min lock).",
         "If the account is a privileged role (manager, official, admin) with MFA enabled, an OTP challenge is created and the response indicates mfa_required. The client then calls POST /auth/verify-privileged-mfa.",
         "On success, a 256-bit session token (crypto.randomBytes(32), base64url) is generated, SHA-256 hashed for database storage, and the raw token returned to the client. The frontend stores it in localStorage under mms.session.token.",
         "Every protected request sends Authorization: Bearer <token>. The authenticateToken middleware looks up the SHA-256 hash in the sessions table, checks expiry, and attaches the user record to the route context."]
      ),

      ...qa("Is multi-factor authentication implemented?",
        ["Yes. Managers, officials, and admins with mfa_enabled=1 are required to complete MFA during login. POST /auth/verify-manager-mfa and POST /auth/verify-privileged-mfa verify OTP codes against SHA-256 hashed challenges stored in the otp_challenges table.",
         "OTP TTL is configurable via OTP_TTL_MINUTES (default 10). OTP codes are generated via crypto.randomInt(100_000, 1_000_000) and hashed with SHA-256 before storage. Verification uses constant-time comparison.",
         "Vendor accounts currently use password + session only in the current implementation. SMS MFA scaffolding (Twilio) is mentioned in the codebase but not fully productised."]
      ),

      ...qa("How are passwords protected?",
        ["Passwords are never stored in plain text. The hashPassword() function generates a 16-byte random salt (crypto.randomBytes(16)), derives a 64-byte key using PBKDF2 with SHA-512 and 100 000 iterations, and stores the result as salt:hash.",
         "Verification extracts the salt and hash, re-derives the key, and uses crypto.timingSafeEqual for constant-time comparison, preventing timing attacks.",
         "The validatePasswordStrength() function enforces minimum length, uppercase, lowercase, digit, and special character requirements."]
      ),

      ...qa("What security controls protect the API?",
        ["Content Security Policy (CSP) restricts script, style, image, font, and connect sources. HTTP Strict Transport Security (HSTS) is enabled with preload. X-Frame-Options is set to DENY to prevent clickjacking. X-Content-Type-Options: nosniff prevents MIME-type sniffing.",
         "Rate limiting operates at three tiers: global (100 requests per 15 min window), auth (5 requests per 15 min window), and API (30 requests per 1 min window), all using sliding-window in-memory stores with X-RateLimit-* headers.",
         "CORS is restricted to configured APP_URL origins. Request body parsing enforces a 25 MB maximum. Account lockout activates after 5 failed attempts (15-minute duration).",
         "All important actions are logged to the audit_events table with actor, role, market, action, entity type, entity ID, details, and timestamp. The STRIDE threat model was used during design to map threats to mitigations."]
      ),

      ...qa("How is vendor registration secured?",
        ["Vendor registration requires: phone OTP verification (SHA-256 hashed, constant-time verified), uploaded identity documents (National ID, LC letter) stored through authenticated endpoints, profile data validation with length limits and regex patterns, and a pending_approval state that blocks all sensitive vendor actions until a manager approves.",
         "The vendor approval gate is enforced both on the frontend (<VendorApprovalGuard>) and backend (requirePermission('vendor:review') + status check). Rejected vendors cannot reserve stalls, make payments, or submit certain actions."]
      ),

      ...qa("How is the system protected against abuse and fraud?",
        ["Account lockout (5 failed attempts → 15 min lock), OTP-based phone verification for registration, MFA for privileged roles, vendor approval gating, rate limiting on auth endpoints, CSP/HSTS/security headers, audit trail for all sensitive operations, server-side session management (tokens revocable server-side), and file MIME-type validation on uploads.",
         "A custom abuse-scenarios test suite (src/test/abuse-scenarios.test.ts) validates these controls programmatically."]
      ),

      ...qa("What security headers does the API set on every response?",
        ["Content-Security-Policy restricts script-src, style-src, img-src, font-src, and connect-src to 'self' and trusted origins (Supabase, Pesapal, Sentry). Strict-Transport-Security is set with max-age=31536000, includeSubDomains, and preload.",
         "X-Frame-Options: DENY prevents clickjacking. X-Content-Type-Options: nosniff prevents MIME-type sniffing. X-XSS-Protection: 1; mode=block enables legacy XSS filtering.",
         "Referrer-Policy: strict-origin-when-cross-origin controls referrer leakage. Permissions-Policy disables geolocation, microphone, camera, payment, USB, and sensor APIs. Cross-Origin-Opener-Policy: same-origin and Cross-Origin-Resource-Policy: same-origin provide cross-origin isolation.",
         "The Server header is removed to avoid fingerprinting. X-Permitted-Cross-Domain-Policies: none restricts Adobe Flash/PDF cross-domain access."]
      ),

      ...qa("How is input validation handled on the server?",
        ["Server-side validation uses a combination of approaches: explicit length limits via assertMaxLength() and assertMinLength() helpers (server/lib/text-utils.ts), regex validation for email and phone formats, phone number normalisation to E.164 format, sanitizeText() for stripping dangerous characters, and file payload validation via validateFilePayload() (MIME type, size limits, base64 decoding).",
         "On the frontend, Zod schemas paired with React Hook Form provide client-side validation as a first line of defence, but the server never trusts client-side validation — all critical checks are re-applied server-side before any database write.",
         "The request body parser enforces a 25 MB maximum (MAX_REQUEST_BODY_BYTES in server/lib/http.ts) to prevent resource exhaustion attacks."]
      ),

      ...qa("How are Pesapal webhooks (IPN) secured?",
        ["Pesapal IPN webhooks arrive at POST /payments/webhooks/pesapal. The backend verifies the IPN payload by calling the Pesapal API's transaction status endpoint using the stored payment external_reference and the configured PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET.",
         "The IPN endpoint is registered server-side via npm run pesapal:register-ipn, which sends the public IPN URL to Pesapal's API and stores the returned IPN ID in the environment (PESAPAL_IPN_ID).",
         "All received webhook payloads are logged to payment_webhook_events for auditability before any payment status update is applied."]
      ),
    ],
  },

  // ── 4. REST API Overview ────────────────────────────────────────
  {
    children: [
      heading("4. REST API Overview", HeadingLevel.HEADING_1),
      para("All routes are prefixed with the API base URL (default http://localhost:3001). Unless noted, protected routes require Authorization: Bearer <session-token>. The table below lists the main endpoint groups examiners ask about during live demos."),
      para(""),

      new Table({
        rows: [
          headerRow(["Route prefix", "Purpose", "Typical caller", "Auth"]),
          dataRow(["/health", "Liveness and readiness probe", "Render / Docker", "Public"]),
          dataRow(["/auth/*", "Login, logout, registration, OTP, MFA, profile, password reset", "All users", "Mixed (public + session)"]),
          dataRow(["/auth/users", "Staff user listing", "Admin", "Session + auth:manage"]),
          dataRow(["/auth/staff", "Create staff accounts", "Admin", "Session + auth:manage"]),
          dataRow(["/auth/managers", "Create manager accounts", "Admin", "Session + auth:manage"]),
          dataRow(["/markets", "Market listing and manager lookup", "All authenticated", "Session"]),
          dataRow(["/vendors", "Vendor listing, profile, documents, approval", "Manager / Admin", "Session + vendor:read/review"]),
          dataRow(["/stalls", "Stall CRUD, reservations, bookings", "Manager / Vendor", "Session + stall:read/write"]),
          dataRow(["/bookings", "Booking review, approval, payment marking", "Manager", "Session + booking:read/update"]),
          dataRow(["/payments", "Payment initiation, Pesapal callbacks, receipts, verification", "All authenticated", "Session + payment:read/create"]),
          dataRow(["/billing", "Charge type listing and enable/disable", "Manager / Admin", "Session + billing:read/manage"]),
          dataRow(["/utility-charges", "Utility bill CRUD and cancellation", "Manager / Vendor", "Session + utility:read/manage"]),
          dataRow(["/penalties", "Penalty CRUD and cancellation", "Manager / Official", "Session + penalty:read/manage"]),
          dataRow(["/tickets", "Complaint CRUD, search, status, comments, escalation", "Vendor / Manager", "Session + ticket:read/create/update"]),
          dataRow(["/notifications", "Notification listing and read-state update", "All authenticated", "Session + notification:read/update"]),
          dataRow(["/reports", "Revenue, dues, tickets, financial-audit reports", "Manager / Official / Admin", "Session + report:read"]),
          dataRow(["/audit", "Audit event listing", "Manager / Official / Admin", "Session + audit:read"]),
          dataRow(["/coordination", "Coordination messages between staff", "Manager / Official / Admin", "Session + coordination:read/write"]),
          dataRow(["/resource-requests", "Manager resource requests and review", "Manager / Official", "Session + resource:read/create/review"]),
          dataRow(["/announcements", "Announcement CRUD", "Manager / Official / Admin", "Session + announcement:read/write"]),
          dataRow(["/fallback", "USSD/SMS simulation (dev only)", "Dev / Testing", "Public (dev)"]),
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
      }),
      para(""),

      ...qa("What is the standard API response format?",
        ["Successful responses return JSON with the requested data directly as the body — e.g., an array for list endpoints (GET /vendors), an object for single-resource endpoints (GET /vendors/:id), or an object with a success message for write operations.",
         "Error responses follow a consistent structure: { error: string, statusCode: number, details?: unknown }. The HttpError class is thrown by route handlers or middleware and caught by the central error handler in server/main.ts, which sends the appropriate HTTP status code and error message.",
         "Rate limit violations return 429 with a Retry-After header. Authentication failures return 401. Authorisation failures return 403. Validation errors return 400. Not-found returns 404."]
      ),

      ...qa("How is API versioning handled?",
        ["The current API does not use explicit URL path versioning (e.g., /v1/). Instead, the API contract evolves through additive changes: new endpoints are added in new route modules, and existing endpoints are extended with optional fields rather than breaking changes.",
         "The openapi.yaml file documents the current API contract. When breaking changes become necessary in the future, a /v2/ prefix strategy will be adopted with a deprecation period for the previous version."]
      ),

      // ── 4.1 How Key APIs Work ──────────────────────────────────
      heading("4.1 How Key APIs Work (Step by Step)", HeadingLevel.HEADING_2),

      ...qa("How does vendor registration work?",
        ["1. Vendor opens /register and fills in name, email, phone, password, market selection, National ID number, district, product section, profile image, National ID document, and LC letter.",
         "2. Frontend converts files to base64 payloads and sends POST /auth/register-vendor.",
         "3. Backend validates input (length limits, email/phone regex, password strength), creates an OTP challenge (6-digit code, SHA-256 hashed, stored in otp_challenges), stores registration data server-side, and sends the OTP via Africa's Talking SMS (or displays it in dev logs).",
         "4. Vendor enters the OTP. POST /auth/verify-registration-otp verifies the code (constant-time comparison against SHA-256 hash, checks expiry via OTP_TTL_MINUTES).",
         "5. On success, the system creates the user record, vendor_profile (status: pending_approval), persists uploaded files (local or Supabase storage), and returns a session token.",
         "6. A manager must later approve the vendor via POST /vendors/:id/approve before the vendor can access protected workflows."]
      ),

      ...qa("How does the stall booking lifecycle work?",
        ["1. Manager creates stalls via POST /stalls (name, zone, size, price_per_month, status).",
         "2. Vendor browses available stalls via GET /stalls and reserves one via POST /stalls/:id/reservations, which creates a booking record.",
         "3. Manager reviews bookings via GET /bookings and can approve (POST /bookings/:id/approve), reject (POST /bookings/:id/reject), mark as paid (POST /bookings/:id/mark-paid), or confirm (POST /bookings/:id/confirm).",
         "4. As the workflow progresses, stall status and assigned_vendor_id are updated accordingly. The one_vendor_one_stall constraint (migration 0022) ensures a vendor cannot be assigned to multiple stalls."]
      ),

      ...qa("How does payment processing work?",
        ["MMS supports two payment paths:",
         "1. Pesapal gateway: POST /payments/initiate creates a Pesapal order via the Pesapal API (server/lib/pesapal.ts), returns a redirect URL or iframe URL (configurable via PESAPAL_USE_IFRAME). The user completes checkout on Pesapal, which sends an IPN webhook (POST /payments/webhooks/pesapal) and redirects to the callback page (GET /payments/pesapal/callback-status). The system updates payment status and marks bookings/charges as paid.",
         "2. Manual receipt: The user submits receipt details and optional receipt file. Staff verify (POST /payments/:id/verify) or reject (POST /payments/:id/reject) the receipt. Verified receipts mark the underlying charge as paid.",
         "Payment attempts are tracked in payment_attempts. Payment webhook events are stored in payment_webhook_events for auditability."]
      ),

      ...qa("How do utility charges and penalties work?",
        ["1. Billing charge types (charge_types table) define whether each charge category is enabled globally or per-market.",
         "2. Managers create utility charges via POST /utility-charges. Charges can be calculated by fixed amount or usage rate.",
         "3. Managers create penalties via POST /penalties, optionally linked to a utility charge.",
         "4. Vendors view and pay outstanding charges via the payments flow.",
         "5. Cancellations are handled via POST /utility-charges/:id/cancel and POST /penalties/:id/cancel with reason tracking."]
      ),

      ...qa("How does the complaint/ticket system work?",
        ["1. Vendors create tickets via POST /tickets with category, priority, subject, description, and optional attachment.",
         "2. Tickets are assigned an auto-generated ticket number (format: TKT-XXXXXXXX). The ticket lifecycle includes states: open → in_progress → resolved / escalated.",
         "3. Staff can add comments (POST /tickets/:ticketNumber/comments), resolve (POST /tickets/:ticketNumber/resolve), or escalate (POST /tickets/:ticketNumber/escalate).",
         "4. SLA tracking is supported via sla_due_at timestamps. All changes are recorded in ticket_updates, ticket_audit_log, ticket_assignments, and ticket_escalations for enterprise-grade auditability."]
      ),

      ...qa("How does the notification system work?",
        ["Notifications are stored in the notifications table with delivery attempts tracked in notification_deliveries.",
         "The API starts a background task every 2 seconds (setInterval in server/main.ts) that processes pending deliveries. It attempts delivery via in-app (notification records read by the frontend) and optionally SMS via Africa's Talking.",
         "Failed deliveries are retried according to NOTIFICATION_RETRY_COUNT with exponential backoff. Notifications are created for events such as vendor approval, booking status changes, payment confirmations, ticket updates, and announcements."]
      ),

      ...qa("How do reports and audit work?",
        ["Reports aggregate operational and financial data: GET /reports/revenue (revenue by period), GET /reports/dues (outstanding dues), GET /reports/tickets (ticket metrics), GET /reports/financial-audit (detailed financial audit trail), and GET /audit (audit event list with filters).",
         "Audit events record every important action with actor, role, market, action type, entity type, entity ID, details (JSON), and ISO timestamp. The audit_events table serves as the immutable record for compliance with Uganda DPPA 2019 requirements."]
      ),

      ...qa("How does the vendor approval workflow work?",
        ["1. A manager opens the vendor management page (GET /vendors) which lists vendors with pending_approval status, including their submitted documents.",
         "2. The manager reviews vendor profile data, National ID document, LC letter, and profile image via GET /vendors/:id and GET /vendors/:id/documents/:type.",
         "3. The manager approves (POST /vendors/:id/approve) or rejects (POST /vendors/:id/reject) with an optional reason.",
         "4. On approval, vendor_profiles.approval_status is set to 'approved', the vendor receives an in-app notification (and optionally SMS), and the vendor gains access to protected workflows (stall reservations, payments).",
         "5. On rejection, the vendor receives a notification and remains blocked from protected actions. They can re-register with corrected information."]
      ),

      ...qa("How does the password reset flow work?",
        ["1. User requests a password reset via POST /auth/forgot-password with their registered phone number.",
         "2. Backend creates an OTP challenge (purpose: 'password_reset'), hashed with SHA-256, stored in otp_challenges, and sends the OTP via Africa's Talking SMS (or displays in dev logs).",
         "3. User submits the OTP and new password via POST /auth/reset-password.",
         "4. Backend verifies the OTP (constant-time comparison, checks expiry), validates the new password strength via validatePasswordStrength(), hashes the new password via hashPassword(), updates the password_hash in users, and revokes all existing sessions for the user via revokeUserSessions().",
         "5. Returns success; the user can log in with the new password."]
      ),
    ],
  },

  // ── 5. Frontend and User Experience ─────────────────────────────
  {
    children: [
      heading("5. Frontend and User Experience", HeadingLevel.HEADING_1),

      ...qa("How is the frontend structured?",
        ["The frontend is a React 18 single-page application bootstrapped with Vite 7. Routes are defined in src/App.tsx with lazy-loaded page components using React.lazy() and Suspense with skeleton fallbacks.",
         "Four workspaces exist: vendor (/vendor/*), manager (/manager/*), official (/official/*), and admin (/admin/*). Each workspace has role-specific dashboards, pages, and navigation. The <AppLayout> component provides the authenticated workspace shell with sidebar navigation, header, and user menu.",
         "The <ProtectedRoute> component wraps all authenticated routes and redirects unauthenticated users to /login. The <VendorApprovalGuard> additionally blocks unapproved vendors from protected workflows."]
      ),

      ...qa("How is internationalisation (i18n) handled?",
        ["The application uses i18next with react-i18next and browser language detection. Three locales are currently supported: English (en.json), Swahili (sw.json), and Luganda (lg.json).",
         "Database columns use _en and _local suffixes where applicable (e.g., description_en, description_local) for market-specific content. The user's language preference is stored in their profile."]
      ),

      ...qa("How is the UI component library organised?",
        ["MMS uses shadcn/ui, which provides 30+ accessible, unstyled primitives built on Radix UI. Components include Accordion, AlertDialog, Avatar, Button, Card, Checkbox, Dialog, DropdownMenu, Form, Input, Popover, Select, Table, Tabs, Toast, Tooltip, and more.",
         "Styling uses Tailwind CSS 3.4 with a custom theme (tailwind.config.ts) defining brand colours, fonts, spacing, and animation tokens. The next-themes library enables light/dark mode toggling.",
         "Charts are rendered with Recharts 2 for dashboard visualisations (revenue trends, booking metrics, ticket statistics). Framer Motion 12 provides page transitions and micro-interactions."]
      ),

      ...qa("How is the API client organised?",
        ["All API calls go through src/lib/api.ts, a typed API client (~620 lines) that defines every endpoint as a function: api.auth.login(), api.vendors.getAll(), api.stalls.create(), etc.",
         "The client handles session token attachment from localStorage, JSON serialization/deserialization, error handling, and redirect on 401. TanStack Query wraps these functions with caching, background refetching, and optimistic update support."]
      ),

      ...qa("What is the accessibility approach?",
        ["MMS uses shadcn/ui components built on Radix UI primitives, which follow WAI-ARIA design patterns for keyboard navigation, screen reader announcements, focus management, and role attributes.",
         "Components such as Dialog, Popover, DropdownMenu, Tabs, and Toast include built-in focus trapping, aria-labelledby, aria-describedby, and Escape-key dismissal. The application supports keyboard navigation through all interactive elements.",
         "Tailwind CSS provides responsive design for different viewport sizes. Colour contrast is maintained through the custom theme tokens in tailwind.config.ts. Light and dark mode are supported via next-themes."]
      ),
    ],
  },

  // ── 6. Database and Data Flow ───────────────────────────────────
  {
    children: [
      heading("6. Database and Data Flow", HeadingLevel.HEADING_1),

      ...qa("What are the main database tables?",
        ["Core entities include: markets, locations (hierarchy: region → city → district → division → subcounty → market), users (all accounts), staff_profiles (manager/official/admin metadata), vendor_profiles (registration, identity, documents, approval status), sessions (bearer token sessions), otp_challenges (registration and MFA OTP), stalls (market stalls), bookings (stall reservations), payments (payment records), payment_attempts (gateway/manual attempts), payment_webhook_events (IPN event log), charge_types (billing controls), utility_charges, penalties, tickets (complaints), ticket_updates, ticket_attachments, ticket_audit_log, ticket_assignments, ticket_escalations, notifications, notification_deliveries, coordination_messages, resource_requests, announcements, audit_events (operational audit trail), bank_deposits, and fallback_queries.",
         "In total, 30+ tables across 22 SQL migration files, evolving from initial schema (0001) through enterprise ticket lifecycle (0017), manual receipt workflow (0018), announcements (0019), account lockout (0021), and one-vendor-one-stall constraint (0022)."]
      ),

      ...qa("How are database changes managed?",
        ["Sequential SQL migration files (0001_initial_schema.sql through 0022_one_vendor_one_stall.sql) are applied with npm run db:migrate. The migration runner tracks applied files in schema_migrations and applies new ones in lexical order.",
         "npm run db:seed loads baseline demo data (markets, locations, staff accounts, vendor accounts, stalls, bookings, payments, utility charges, penalties, tickets with full lifecycle data).",
         "npm run db:check validates database connectivity and data integrity. Backup scripts (scripts/backup-database.ts) provide create, list, verify, and restore operations."]
      ),

      ...qa("How are database queries structured?",
        ["The server/lib/db.ts module exports a PostgreSQL connection pool (pg.Pool) and three query helpers: run() for writes, get() for single-row reads, and all() for multi-row reads. Placeholder ? characters are automatically converted to $1, $2, ... (PostgreSQL positional parameters).",
         "Transaction support uses AsyncLocalStorage context propagation. The transaction() helper wraps multiple queries in a BEGIN/COMMIT/ROLLBACK block. Audit events are logged via logAuditEvent() after sensitive operations.",
         "No ORM is used — all queries are hand-written SQL, giving full control over JOINs, window functions, CTEs, and aggregation for reporting queries."]
      ),

      ...qa("What is the database indexing strategy?",
        ["Indexes are defined either inline in migration CREATE TABLE statements or as CREATE INDEX statements in later migrations. Key indexes include: users(phone) for login lookups, users(email) for unique email enforcement, sessions(token_hash) for fast session validation, tickets(ticket_number) for search, tickets(assigned_to, status) for manager views, payments(booking_id) and payments(utility_charge_id) and payments(penalty_id) for charge-to-payment lookups, audit_events(created_at, actor, action) for audit trail queries, and vendor_profiles(approval_status, market_id) for manager vendor listing.",
         "Migration 0020 explicitly adds an index on vendor_profiles.approval_status to optimise the pending-vendors query that managers use frequently.",
         "No composite index tuning has been done beyond these basics — query performance is monitored via application-level logging, and additional indexes would be added based on observed slow queries in production."]
      ),

      ...qa("What is the data backup and disaster recovery strategy?",
        ["The scripts/backup-database.ts script provides create (pg_dump-based full backup with timestamped files), list (show available backups), verify (checksum validation), and restore (pg_restore) operations.",
         "Backups include the full schema and data. In production (Render/Supabase), the managed PostgreSQL provider typically handles automated daily backups with point-in-time recovery. For local deployments, operators should schedule the backup script via cron or a scheduled task.",
         "The repository and environment variables constitute the 'configuration backup' — the schema is fully reproducible via npm run db:migrate, and seed data can be reloaded via npm run db:seed. File uploads stored in runtime/uploads should be backed up separately or migrated to Supabase Storage for managed redundancy."]
      ),
    ],
  },

  // ── 7. Deployment and Operations ────────────────────────────────
  {
    children: [
      heading("7. Deployment and Operations", HeadingLevel.HEADING_1),

      ...qa("Where is MMS hosted in the pilot?",
        ["Typical pilot layout: Vercel serves the static frontend (configured via vercel.json), Render runs the Node API (configured via render.yaml with health check on /health), and PostgreSQL runs on a managed provider (Supabase or similar) or local Postgres.",
         "Environment variables (DATABASE_URL, APP_URL, API_URL, PESAPAL_* keys, AFRICAS_TALKING_* keys, etc.) configure each tier. The openapi.yaml file documents the API contract."]
      ),

      ...qa("What is the Docker deployment option?",
        ["The docker-compose.yml defines 6 services on a shared bridge network: postgres (PostgreSQL 16 Alpine on port 5432), redis (Redis 7 Alpine on port 6379), api (MMS API on port 3001), web (Vite dev frontend on port 5173), prometheus (metrics collection on port 9090), and grafana (dashboards on port 3000).",
         "The Dockerfile uses multi-stage builds: base (node:22-alpine) → deps (npm ci) → builder (build + prune) → runner (production). It runs as a non-root user (nodeuser) with a health check at /health."]
      ),

      ...qa("What is the CI/CD pipeline?",
        ["The GitHub Actions workflow (.github/workflows/ci.yml) runs 4 jobs: lint (ESLint + TypeScript type checking), unit tests (Vitest with PostgreSQL 16 container, migrations, and seed), E2E tests (Playwright with Chromium on full stack), security scan (Snyk high+ severity + npm audit), build (Docker image build + push to Docker Hub), and deploy (Render API deploy + migration + Slack notification).",
         "The pipeline triggers on push to main and pull requests."]
      ),

      ...qa("How do you verify the system before a panel presentation?",
        ["1. Start PostgreSQL: docker compose up -d postgres.",
         "2. Run migrations: npm run db:migrate.",
         "3. Seed demo data: npm run db:seed.",
         "4. Start API: npm run dev:api (port 3001).",
         "5. Start frontend: npm run dev:web (port 5173).",
         "6. Run automated tests: npm run test (23 test files across 12 functional areas).",
         "7. Manual walkthrough: vendor (register, login, stalls, payments, tickets) → manager (vendor approval, stall management, bookings, utility charges, penalties) → official (reports, compliance, analytics) → admin (user management, billing controls, system oversight).",
         "Demo accounts (password: Admin123! / Official123! / Manager123! / Vendor123!): +256701111222 (admin), +256700600700 (official), +256700500600 (manager), +256700100200 (vendor)."]
      ),

      ...qa("How is the system monitored in production?",
        ["Monitoring uses three layers: (1) Sentry for error tracking — uncaught exceptions, unhandled rejections, and caught errors in route handlers are reported with context, stack traces, and user/breadcrumb data. Sampling is configurable via SENTRY_SAMPLE_RATE and SENTRY_TRACES_SAMPLE_RATE.",
         "(2) Health checks — GET /health returns database connectivity status, used by Render and Docker for liveness/readiness probes. The health module (server/modules/health.ts) tracks request counts and background task states.",
         "(3) Prometheus + Grafana (optional, in docker-compose.yml) — Prometheus collects metrics from the API on port 9090, and Grafana provides dashboards on port 3000. These are provisioned for local development and can be extended for production use."]
      ),

      ...qa("How are environment-specific configurations managed?",
        ["Configuration is driven entirely by environment variables, loaded at startup in server/config.ts. The .env.example file documents all 41+ variables with their purposes and defaults. The startup-validation.ts module validates required variables on boot and refuses to start if critical ones (JWT_SECRET, DATABASE_URL) are missing or set to insecure defaults.",
         "The .env file is git-ignored. Separate .env.local can override values for local development. For production (Render), configuration is set via the Render dashboard environment variables. For Vercel deployment, VITE_API_BASE_URL is set as a Vercel environment variable.",
         "The appEnv variable (from APP_ENV) drives behaviour changes: production mode disables debug OTP routes, enforces stricter CORS, and skips seed-on-boot unless explicitly enabled."]
      ),
    ],
  },

  // ── 8. Frequently Asked Panel Questions ─────────────────────────
  {
    children: [
      heading("8. Frequently Asked Panel Questions (Quick Answers)", HeadingLevel.HEADING_1),

      ...qa("Does MMS work offline?",
        ["No. MMS requires network connectivity for all operations. TanStack Query provides in-memory caching but no persistent offline support. Service worker registration and PWA offline capabilities are not implemented in the current version."]
      ),

      ...qa("How do you prevent unauthorised vendors from accessing the system?",
        ["Vendor registration requires phone OTP verification. New vendors are created in pending_approval state and cannot access protected workflows (stall reservations, payments, etc.) until a manager explicitly approves them. The <VendorApprovalGuard> enforces this on the frontend, and requirePermission checks enforce it on the backend."]
      ),

      ...qa("How is payment data protected?",
        ["Payment data is stored server-side in the payments and payment_attempts tables. Sensitive payment processing is handled by Pesapal's PCI-compliant gateway — the MMS backend never stores credit card details. Manual receipt verification is tracked in the payment lifecycle with audit logging. The PAYMENTS_ENABLED env var provides a kill switch."]
      ),

      ...qa("What happens if the session token is compromised?",
        ["Session tokens are 256-bit random values (32 bytes, base64url). If a token is compromised, an admin can revoke the user's sessions (revokeUserSessions in passwords.ts), which deletes all active sessions for that user from the sessions table. The SESSION_TTL_HOURS env var limits exposure (default 24 h). Failed login lockout (5 attempts → 15 min) mitigates brute-force attacks."]
      ),

      ...qa("How does the system ensure data integrity?",
        ["Foreign key constraints across all related tables, SQL transaction wrappers for multi-step operations (transaction() helper with AsyncLocalStorage), audit logging for all sensitive operations (audit_events table), the one_vendor_one_stall constraint (migration 0022), and server-side input validation with length limits, email/phone regex, and Zod schemas on the frontend."]
      ),

      ...qa("How is personal data protected under Uganda DPPA 2019?",
        ["Passwords hashed with PBKDF2 (100 000 iterations, SHA-512), sessions stored server-side (not in JWTs exposed to client inspection), profile consents tracked per user, document access restricted to authorised managers/staff, audit trail for all data access, CORS-limited API access, CSP and security headers preventing data exfiltration vectors, and configurable session TTL."]
      ),

      ...qa("Can managers see all vendors across all markets?",
        ["No. Managers are scoped to their assigned market via the staff_profiles.assigned_region and market_id. The assertMarketAccess() and resolveScopedMarket() helpers in server/lib/session.ts enforce market-level data isolation. Only officials and admins can view data across multiple markets."]
      ),

      ...qa("How are payments reconciled?",
        ["Payments are reconciled through Pesapal IPN webhooks (POST /payments/webhooks/pesapal) and callback status checks (GET /payments/pesapal/callback-status). Manual receipts go through a verification workflow where staff verify or reject submitted receipt details. The payment_attempts and payment_webhook_events tables provide full auditability of each payment lifecycle."]
      ),

      ...qa("What is NOT fully implemented yet?",
        ["Full WebSocket/Socket.io real-time updates (current polling approach), native mobile apps, full OSRM turn-by-turn navigation, automated SMS MFA for vendors, AI/ML chatbots or recommendations, service worker offline support, and Redis session store integration (Redis is provisioned in Docker but sessions currently use PostgreSQL only). See docs/functional-requirements-tracker.md for the honest checklist if that file exists."]
      ),

      ...qa("How does the system handle concurrency?",
        ["PostgreSQL handles concurrent transactions with ACID guarantees. The background notification delivery loop is single-threaded to avoid race conditions. Rate limiting prevents API abuse. The one_vendor_one_stall constraint prevents double-allocation of stalls. SQL transactions wrap multi-step booking and payment workflows."]
      ),

      ...qa("How are file uploads secured?",
        ["Uploaded files (profile images, National ID documents, LC letters, ticket attachments, receipt files) are validated server-side via validateFilePayload() which checks MIME type against allowed types, enforces maximum file size, and verifies base64 decoding before storage.",
         "Files are stored under runtime/uploads (or optionally Supabase Storage) and served exclusively through authenticated API endpoints (GET /vendors/:id/documents/:type, GET /users/:id/profile-image, GET /payments/:id/receipt-file) — there are no direct public file URLs.",
         "The storage.ts module handles both local filesystem persistence and optional Supabase Storage uploads. File paths are stored in the database; actual files are never accessible without authentication."]
      ),

      ...qa("How are third-party dependencies managed and audited?",
        ["Dependencies are declared in package.json with exact versions (no caret ranges for most packages). npm ci is used in CI and Docker builds for reproducible installs.",
         "Security auditing is automated in CI via two tools: npm audit (runs on every push, fails on high/critical vulnerabilities) and Snyk (scans for known vulnerabilities in the dependency tree, also enforced in CI).",
         "The package-lock.json is committed to version control to ensure deterministic installations across environments. Dev dependencies are excluded from production Docker images via multi-stage builds (npm ci --production in the runner stage).",
         "Key libraries are kept up to date — the lockfile shows 30+ Radix UI packages at recent versions, React 18.3, TanStack Query 5.83, and Vite 7.3."]
      ),

      ...qa("What is the Content Security Policy and why is it configured this way?",
        ["The CSP (configured in server/lib/security-headers.ts) uses default-src 'self' as the base restriction. Script sources are limited to 'self'. Style sources allow 'self' and 'unsafe-inline' (required for Tailwind's JIT mode and shadcn's dynamic styles).",
         "Image sources include 'self', data: (for inline images and base64 file previews), and blob: (for dynamically generated blobs). Font sources include 'self' and data: (for icon fonts).",
         "Connect-src allows 'self', Supabase API subdomains (https://*.supabase.co), Pesapal payment endpoints (https://*.pesapal.com, https://*.pesapal.net), and the configured Sentry DSN (https://o4502*.ingest.us.sentry.io).",
         "Frame-ancestors is set to 'none' to prevent clickjacking. This CSP configuration balances security with the practical needs of a React SPA that uses external payment and storage services."]
      ),

      ...qa("Can the system be deployed on a local intranet without internet access?",
        ["Yes. The entire stack can run on a local network using Docker Compose without external dependencies, provided Pesapal and Africa's Talking are not required (or are accessible through a proxy).",
         "The docker-compose.yml provisions PostgreSQL and Redis locally. The frontend and API communicate over the internal Docker network. File storage defaults to the local filesystem (runtime/uploads).",
         "For a fully air-gapped deployment, the Pesapal payment gateway would need to be replaced with a manual receipt-only workflow (already supported), and SMS notifications would fall back to in-app-only delivery."]
      ),

      ...qa("How does the system handle failed payment transactions?",
        ["Failed Pesapal transactions are recorded in payment_attempts with the provider response status. The payment remains in its current state (pending) and the vendor can retry. Payment webhook events are logged in payment_webhook_events for auditability.",
         "Manual receipt submissions that are rejected by staff (POST /payments/:id/reject) return to an unpaid state with the rejection reason recorded. The PAYMENTS_ENABLED environment variable provides a global kill switch to disable all payment actions during maintenance."]
      ),
    ],
  },

  // ── 9. Auth Endpoint Reference ──────────────────────────────────
  {
    children: [
      heading("9. Auth Endpoint Reference", HeadingLevel.HEADING_1),
      para(""),

      new Table({
        rows: [
          headerRow(["Method", "Path", "Description"]),
          dataRow(["POST", "/auth/login", "Phone + password authentication; returns session token (or MFA challenge for privileged roles)"]),
          dataRow(["POST", "/auth/logout", "Destroy current session"]),
          dataRow(["GET", "/auth/me", "Return current authenticated user profile"]),
          dataRow(["PATCH", "/auth/me", "Update own profile fields"]),
          dataRow(["POST", "/auth/register-vendor", "Submit vendor registration with files as base64 payloads"]),
          dataRow(["POST", "/auth/verify-registration-otp", "Verify registration OTP code and activate account"]),
          dataRow(["POST", "/auth/change-password", "Change password (requires current password)"]),
          dataRow(["POST", "/auth/forgot-password", "Request password reset OTP"]),
          dataRow(["POST", "/auth/reset-password", "Complete password reset with OTP"]),
          dataRow(["POST", "/auth/verify-manager-mfa", "Complete MFA challenge for manager role"]),
          dataRow(["POST", "/auth/verify-privileged-mfa", "Complete MFA challenge for official/admin role"]),
          dataRow(["GET", "/auth/users", "List all staff users (admin only)"]),
          dataRow(["POST", "/auth/staff", "Create staff account (admin only)"]),
          dataRow(["POST", "/auth/managers", "Create manager account (admin only)"]),
          dataRow(["POST", "/auth/debug/otp", "Debug: retrieve OTP code in development (dev only)"]),
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
      }),
    ],
  },

  // ── 10. Document References ─────────────────────────────────────
  {
    children: [
      heading("10. Document References", HeadingLevel.HEADING_1),
      para("Repository documentation aligned with this Q&A:"),

      bullet("docs/authorization-audit-design.md — Auth and audit design notes"),
      bullet("docs/abuse-prevention-design.md — Abuse prevention and security controls"),
      bullet("docs/penalties-compliance-design.md — Penalty and compliance workflow"),
      bullet("docs/utilities-billing-design.md — Utility billing charge design"),
      bullet("docs/production-readiness-report.md — Production readiness assessment"),
      bullet("docs/SIGTS-Technical-Stack-APIs-Panel-QA.docx — Reference SIGTS Q&A document (earlier project)"),
      bullet("ARCHITECTURE_DIAGRAM.md — System architecture with ASCII diagrams"),
      bullet("README.md — Full project documentation (setup, workflows, config)"),
      bullet("openapi.yaml — OpenAPI contract specification"),
      bullet("RELEASE.md — Release notes and version history"),

      para(""),
      para("Regenerate this Word file after major stack changes:", { italic: true }),
      para("  node --experimental-strip-types scripts/generate-mms-tech-qa-docx.ts", { italic: true }),
    ],
  },
];

// ── Build Document ──────────────────────────────────────────────────
const doc = new Document({
  title: "MMS Technical Stack, APIs, and Panel Q&A",
  description: "Technical Q&A document for the Market Management System project",
  styles: {
    default: {
      document: {
        run: { size: 22, font: "Calibri" },
        paragraph: { spacing: { after: 120 } },
      },
    },
  },
  sections: sections.map((section) => ({
    properties: {
      page: {
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "MMS — Technical Stack, APIs, and Panel Q&A", size: 16, color: "9CA3AF" })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Page ", size: 16, color: "9CA3AF" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "9CA3AF" }),
            new TextRun({ text: " of ", size: 16, color: "9CA3AF" }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: "9CA3AF" }),
          ],
        })],
      }),
    },
    children: section.children,
  })),
});

// ── Write file ──────────────────────────────────────────────────────
const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(OUTPUT, buffer);
console.log(`✅ Generated ${OUTPUT} (${(buffer.byteLength / 1024).toFixed(1)} KB)`);
