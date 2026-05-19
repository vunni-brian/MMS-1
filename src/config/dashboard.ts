/**
 * Dashboard configuration constants
 * Centralized magic numbers and limits for consistency across dashboards
 */

export const DASHBOARD_CONFIG = {
  // Data fetching limits
  DEFAULT_PAGE_SIZE: 10,
  DASHBOARD_PREVIEW_LIMIT: 5,
  RECENT_ITEMS_LIMIT: 5,
  ALERTS_LIMIT: 5,
  USER_PREVIEW_LIMIT: 5,
  VENDOR_PREVIEW_LIMIT: 8,
  STALL_PREVIEW_LIMIT: 5,
  PAYMENT_PREVIEW_LIMIT: 6,
  BOOKING_PREVIEW_LIMIT: 4,
  COMPLAINT_PREVIEW_LIMIT: 5,
  AUDIT_PREVIEW_LIMIT: 5,
  RESOURCE_REQUEST_PREVIEW_LIMIT: 4,
  UTILITY_PREVIEW_LIMIT: 3,

  // Refresh intervals (milliseconds)
  PAYMENTS_REFRESH_INTERVAL: 10_000,
  UTILITIES_REFRESH_INTERVAL: 10_000,
  NOTIFICATIONS_REFRESH_INTERVAL: 30_000,

  // Cache times (milliseconds)
  DEFAULT_CACHE_TIME: 5 * 60 * 1000, // 5 minutes
  STATIC_DATA_CACHE_TIME: 30 * 60 * 1000, // 30 minutes
  REALTIME_DATA_CACHE_TIME: 0, // No cache for real-time data

  // Risk thresholds
  MARKET_RISK_THRESHOLDS: {
    CRITICAL_FAILED_PAYMENTS: 3,
    CRITICAL_COMPLAINTS: 5,
    CRITICAL_PENALTIES: 3,
    CRITICAL_UTILITIES_DUE: 2_000_000,
    ESCALATE_COMPLAINTS: 5,
    ESCALATE_OVERDUE: 4,
    ESCALATE_FAILED_PAYMENTS: 3,
  },

  // Renewal warning period (days)
  RENEWAL_WARNING_DAYS: 7,

  // Multi-stall violation threshold
  MULTI_STALL_LIMIT: 1,
} as const;

export type DashboardConfig = typeof DASHBOARD_CONFIG;
