# Abuse Prevention Design

## Overview

MMS implements defense-in-depth for input validation and abuse prevention. All user-supplied text passes through length validation and HTML sanitization before storage, preventing stored XSS, oversized payloads, and common injection vectors.

## Layers

### Layer 1: Request Body Size Limit

All JSON request bodies are capped at **25 MB** by `readJsonBody` in `server/lib/http.ts`. Bodies exceeding this limit receive a `413 Payload Too Large` response before any parsing occurs.

### Layer 2: Input Max-Length Validation

Every POST, PUT, and PATCH handler validates text field lengths using `assertMaxLength` from `server/lib/text-utils.ts`. The function throws `400 Bad Request` with a descriptive message when a value exceeds its limit.

| Constant | Value | Used For |
|----------|-------|----------|
| MAX_NAME_LENGTH | 200 | User/display names |
| MAX_EMAIL_LENGTH | 255 | Email addresses |
| MAX_PHONE_LENGTH | 20 | Phone numbers |
| MAX_MESSAGE_LENGTH | 5000 | Comments, notification bodies |
| MAX_SUBJECT_LENGTH | 200 | Ticket subjects |
| MAX_TITLE_LENGTH | 200 | Resource request titles |
| MAX_DESCRIPTION_LENGTH | 5000 | Long-form descriptions |
| MAX_NOTE_LENGTH | 2000 | Internal notes, resolution notes |
| MAX_REASON_LENGTH | 500 | Rejection/penalty/escalation reasons |
| MAX_ADDRESS_LENGTH | 500 | Address fields |
| MAX_STALL_NAME_LENGTH | 100 | Stall names |
| MAX_ZONE_LENGTH | 100 | Stall zones |
| MAX_SIZE_LENGTH | 50 | Stall sizes |
| MAX_IDENTIFIER_LENGTH | 100 | National ID, staff identifiers |
| MAX_DEPARTMENT_LENGTH | 100 | Department names |
| MAX_REGION_LENGTH | 100 | Region/area names |
| MAX_UNIT_LENGTH | 50 | Utility measurement units |
| MAX_BILLING_PERIOD_LENGTH | 50 | Billing period labels |
| MAX_INPUT_LENGTH | 500 | Fallback USSD/SMS input |
| MAX_REFERENCE_LENGTH | 100 | Transaction/receipt references |

### Layer 3: HTML Sanitization

All user-supplied text is passed through `sanitizeText` before storage. The function escapes five HTML-significant characters:

| Character | Entity |
|-----------|--------|
| `<` | `&lt;` |
| `>` | `&gt;` |
| `"` | `&quot;` |
| `'` | `&#x27;` |
| `/` | `&#x2F;` |

This prevents stored XSS by ensuring user-supplied data cannot break out of HTML context when rendered in the frontend. React's default JSX escaping provides a secondary defense layer for any data that reaches the browser.

### Layer 4: Rate Limiting

Global, auth-specific, and API-specific rate limiting is enforced by `server/lib/rate-limit.ts`:

| Strategy | Window | Max Requests | Scope |
|----------|--------|-------------|-------|
| global | 15 min | 100 | All non-health routes |
| auth | 15 min | 5 | `/auth/*` routes |
| api | 1 min | 30 | All other authenticated routes |

Client identity is resolved from `x-forwarded-for` → `x-real-ip` → `socket.remoteAddress`.

### Layer 5: Production Config Validation

At startup, `server/lib/startup-validation.ts` checks for unsafe production configurations:
- `MMS_SEED_ON_BOOT` must not be `true` in production
- Pesapal credentials must be configured when payments are enabled
- IPN URL and ID must be registered for production payments
- Pesapal base URL must point to production (not sandbox)
- Database URL must not use localhost
- SMS sandbox mode must be disabled
- Database must be reachable

## Endpoints Covered

### Max-Length Validation

Every unsafe endpoint in the following modules has per-field max-length validation:

- `auth.ts`: staff invite, vendor registration, manager assignment, profile update
- `vendors.ts`: profile update, password reset, approve, reject
- `stalls.ts`: create stall, update stall, approve/reject booking, mark paid
- `tickets.ts`: create ticket, add comment, update status, resolve, escalate
- `announcements.ts`: create announcement
- `coordination.ts`: send message
- `resources.ts`: create request, review request
- `utilities.ts`: create charge
- `penalties.ts`: issue penalty
- `payments.ts`: initiate payment, verify receipt
- `fallback.ts`: USSD and SMS simulation

### HTML Sanitization

User text is sanitized before storage in all endpoints that accept:

- Display names (user, vendor, stall)
- Descriptions and subjects
- Comments and notes
- Reasons for rejection/escalation/cancellation
- Announcement content
- Coordination messages
- Resource request details
- Utility charge descriptions and billing periods
- Penalty reasons
- Payment receipt references and notes
- Fallback simulation input

## Tests

30 abuse scenario unit tests in `src/test/abuse-scenarios.test.ts` cover:

- `assertMaxLength` edge cases (valid, overflow, null, undefined, empty)
- `sanitizeText` correctness (all five entity encodings, null/undefined)
- Common XSS patterns (script tags, event handlers, iframes, href injection)
- Large payload stress testing (1000x repeated patterns)
- Combined sanitize-then-validate flow
