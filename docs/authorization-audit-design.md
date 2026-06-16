# Backend Authorization Audit (Phase 10)

## Scope

A comprehensive audit of all backend API route handlers to verify correct permission enforcement, role-based access control, and market-scoped data isolation.

## Audit Criteria

Each route was verified against the following criteria:

1. **Authentication**: Every route except health and public endpoints validates the session bearer token
2. **Permission check**: Mutating routes require the appropriate `Permission` type via `requirePermission()` or `resolveScopedMarket()`
3. **Role scoping**: Vendor routes verify the authenticated user is the owner of the resource
4. **Market isolation**: Cross-market data access is blocked by `assertMarketAccess()` and `resolveScopedMarket()`
5. **Account status**: Locked, rejected, or unverified accounts cannot perform privileged actions

## Route Audit Summary

### Public / Unauthenticated Routes

| Route | Method | Protection |
|-------|--------|------------|
| `/health` | GET | None (health check) |
| `/health/detailed` | GET | None |
| `/health/ready` | GET | None |
| `/health/live` | GET | None |
| `/health/metrics` | GET | None |
| `/payments/webhooks/pesapal` | POST | None (IPN) |
| `/payments/pesapal/callback-status` | GET | None (callback) |

### Auth Routes

| Route | Method | Permission | Notes |
|-------|--------|------------|-------|
| `/auth/login` | POST | None | Rate-limited (5/15min) |
| `/auth/register-vendor` | POST | None | Rate-limited |
| `/auth/verify-registration-otp` | POST | None | Challenge-gated |
| `/auth/verify-manager-mfa` | POST | None | Challenge-gated |
| `/auth/verify-privileged-mfa` | POST | None | Challenge-gated |
| `/auth/users` | GET | `auth:manage` | Admin only |
| `/auth/staff` | POST | `auth:manage` | Admin only |
| `/auth/managers` | POST | admin role | Admin only |
| `/auth/change-password` | POST | auth required | Owner only |
| `/auth/logout` | POST | auth required | Session gated |
| `/auth/me` | GET/PATCH | auth required | Owner only |
| `/users/:id/profile-image` | GET | auth required | Market-scoped |
| `/auth/unlock/:userId` | POST | `auth:manage` | Admin only |

### Vendor Routes

| Route | Method | Permission | Notes |
|-------|--------|------------|-------|
| `/vendors` | GET | `vendor:read` | Market-scoped |
| `/vendors/:id` | GET | `vendor:read` | Owner or market-scoped |
| `/vendors/:id/activity` | GET | `vendor:read` | Owner or market-scoped |
| `/vendors/:id/documents/:type` | GET | `vendor:read` | Owner or market-scoped |
| `/vendors/:id/profile` | PATCH | auth required | Owner only |
| `/vendors/:id/reset-password` | POST | `vendor:review` | Manager+ scoped |
| `/vendors/:id/approve` | POST | `vendor:review` | Manager+ scoped |
| `/vendors/:id/reject` | POST | `vendor:review` | Manager+ scoped |

### Stall Routes

| Route | Method | Permission | Notes |
|-------|--------|------------|-------|
| `/stalls` | GET | `stall:read` | Market-scoped |
| `/stalls` | POST | `stall:write` | Manager+, market-scoped |
| `/stalls/:id` | PATCH | `stall:write` | Manager+, market-scoped |
| `/bookings` | GET | `booking:read` | Market-scoped |
| `/stalls/:id/reservations` | POST | `booking:create` | Vendor only, status-gated |
| `/bookings/:id/approve` | POST | `booking:update` | Manager+, market-scoped |
| `/bookings/:id/reject` | POST | `booking:update` | Manager+, market-scoped |
| `/bookings/:id/mark-paid` | POST | `billing:manage` | Staff, market-scoped |
| `/bookings/:id/confirm` | POST | `booking:update` | Manager+, market-scoped |

### Payment Routes

| Route | Method | Permission | Notes |
|-------|--------|------------|-------|
| `/payments` | GET | `payment:read` | Market-scoped |
| `/payments/initiate` | POST | `payment:create` | Vendor only |
| `/payments/:id/receipt-file` | GET | `payment:read` | Market-scoped |
| `/payments/:id/verify` | POST | `payment:create` | Staff only, market-scoped |
| `/payments/:id/receipt` | GET | `payment:read` | Market-scoped |

### Ticket Routes

| Route | Method | Permission | Notes |
|-------|--------|------------|-------|
| `/tickets` | GET | `ticket:read` | Market-scoped, vendor self-only |
| `/tickets/search` | GET | `ticket:read` | Market-scoped |
| `/tickets` | POST | `ticket:create` | Vendor only, market-gated |
| `/tickets/:ticketNumber` | GET | `ticket:read` | Owner or market-scoped |
| `/tickets/:ticketNumber/comments` | POST | `ticket:update` | Owner or market-scoped |
| `/tickets/:ticketNumber/status` | PUT | `ticket:update` | Staff, market-scoped |
| `/tickets/:ticketNumber/resolve` | PUT | `ticket:update` | Staff, market-scoped |
| `/tickets/:ticketNumber/escalate` | POST | `ticket:update` | Staff, market-scoped |
| `/tickets/:id` | PATCH | `ticket:update` | Staff, market-scoped |

### Remaining Routes

All routes in `notifications.ts`, `billing.ts`, `reports.ts`, `coordination.ts`, `resources.ts`, `utilities.ts`, `penalties.ts`, and `announcements.ts` were verified to include appropriate `requirePermission()` or `resolveScopedMarket()` guards matching the required role and market scope for each operation.

## Result

All routes pass the audit criteria. No unauthorized access paths were found.
