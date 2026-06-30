/**
 * @file Central type definitions.
 * All shared TypeScript types, interfaces, and enums used across the MMS
 * (Market Management System) server.
 */

/** User role within the system. */
export type Role = "vendor" | "manager" | "official" | "admin";
/** Ordered list of roles from least to most privileged. */
export const roleOrder: Role[] = ["vendor", "manager", "official", "admin"];

/** System permission identifiers used for access control. */
export type Permission =
  | "auth:manage"
  | "billing:read"
  | "billing:manage"
  | "utility:read"
  | "utility:manage"
  | "penalty:read"
  | "penalty:manage"
  | "vendor:read"
  | "vendor:review"
  | "coordination:read"
  | "coordination:write"
  | "resource:read"
  | "resource:create"
  | "resource:review"
  | "stall:read"
  | "stall:write"
  | "booking:read"
  | "booking:create"
  | "booking:update"
  | "payment:read"
  | "payment:create"
  | "notification:read"
  | "notification:update"
  | "announcement:read"
  | "announcement:write"
  | "ticket:read"
  | "ticket:create"
  | "ticket:update"
  | "report:read"
  | "audit:read"
  | "fallback:query";

/** Approval lifecycle status for vendor profiles. */
export type VendorApprovalStatus = "pending" | "approved" | "rejected";
/** Status for staff accounts. */
export type StaffStatus = "active" | "pending" | "suspended";
/** Operational status of a market stall. */
export type StallStatus = "active" | "inactive" | "maintenance";
/** Lifecycle status of a booking. */
export type BookingStatus = "pending" | "approved" | "rejected" | "paid";
/** Transaction status of a payment. */
export type PaymentStatus = "initiating" | "pending" | "completed" | "failed" | "cancelled";
/** Supported payment providers. */
export type PaymentProvider = "mtn" | "airtel" | "pesapal" | "receipt";
/** Named charge types for billing. */
export const CHARGE_TYPE_NAMES = ["market_dues", "utilities", "penalties", "booking_fee", "payment_gateway"] as const;
export type ChargeTypeName = typeof CHARGE_TYPE_NAMES[number];
/** Whether a charge type applies globally or per-market. */
export type ChargeTypeScope = "global" | "market";
/** Categories of utility services. */
export type UtilityType = "electricity" | "water" | "sanitation" | "garbage" | "other";
/** How a utility charge amount is calculated. */
export type UtilityCalculationMethod = "metered" | "estimated" | "fixed";
/** Status of a utility charge. */
export type UtilityChargeStatus = "unpaid" | "pending" | "pending_payment" | "paid" | "overdue" | "cancelled";
/** Status of a penalty record. */
export type PenaltyStatus = "unpaid" | "pending" | "pending_payment" | "paid" | "cancelled";
/** Lifecycle status of a support ticket. */
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
/** Priority level of a support ticket. */
export type TicketPriority = "low" | "medium" | "high" | "urgent";
/** Category of a support ticket. */
export type TicketCategory =
  | "billing"
  | "maintenance"
  | "dispute"
  | "payment"
  | "stall"
  | "sanitation"
  | "harassment"
  | "other";
/** Notification type identifiers. */
export type NotificationType = "otp" | "payment" | "booking" | "complaint" | "system";
/** Notification priority levels. */
export type NotificationPriority = "low" | "normal" | "high";
/** Delivery channel for notifications. */
export type NotificationChannel = "system" | "sms" | "email";
/** Purpose of an OTP challenge. */
export type OtpPurpose = "registration" | "manager_mfa";
/** Category of a resource request from a market manager. */
export type ResourceRequestCategory = "budget" | "structural";
/** Status of a resource request. */
export type ResourceRequestStatus = "pending" | "approved" | "rejected";
/** Hierarchical location types for market geography. */
export type LocationType = "region" | "city" | "district" | "division" | "municipality" | "subcounty" | "market";

/** Represents a market entity with location hierarchy and vendor/stall counts. */
export interface Market {
  id: string;
  name: string;
  code: string;
  location: string;
  locationId: string | null;
  locationName: string | null;
  locationType: LocationType | null;
  subAreaId: string | null;
  subAreaName: string | null;
  areaId: string | null;
  areaName: string | null;
  regionId: string | null;
  regionName: string | null;
  managerUserId: string | null;
  managerName: string | null;
  vendorCount: number;
  stallCount: number;
  activeStallCount: number;
  inactiveStallCount: number;
  maintenanceStallCount: number;
}

/** Represents an uploaded file attachment with storage metadata. */
export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  storagePath: string;
  createdAt: string;
}

/** Summary of a market manager for list views. */
export interface MarketManagerSummary {
  id: string;
  name: string;
  email: string;
  phone: string;
  marketId: string | null;
  marketName: string | null;
}

/** Authenticated user payload returned by the auth system. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  permissions: Permission[];
  createdAt: string;
  vendorStatus: VendorApprovalStatus | null;
  phoneVerifiedAt: string | null;
  marketId: string | null;
  marketName: string | null;
  profileImage: Attachment | null;
  productSection?: string | null;
}

/** Staff account with profile, permissions, and role metadata. */
export interface StaffAccount {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  department: string | null;
  assignedRegion: string | null;
  staffIdentifier: string | null;
  accessLevel: string;
  status: StaffStatus;
  permissions: Permission[];
  responsibilities: string[];
  marketId: string | null;
  marketName: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  vendorStatus: VendorApprovalStatus | null;
}

/** Result of a successful session authentication. */
export interface SessionAuth {
  token: string;
  user: AuthUser;
}

/** Base64-encoded file payload for uploads. */
export interface FilePayload {
  name: string;
  mimeType: string;
  size: number;
  base64: string;
}

/** Global application configuration derived from environment variables. */
export interface AppConfig {
  apiPort: number;
  appEnv: string;
  appName: string;
  appUrl: string;
  appUrls: string[];
  apiUrl: string;
  dataDir: string;
  uploadsDir: string;
  databaseUrl: string;
  migrationDatabaseUrl: string | null;
  databaseSsl: boolean;
  autoMigrate: boolean;
  seedOnBoot: boolean;
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  supabaseServiceRoleKey: string | null;
  supabaseStorageBucket: string;
  supabaseAuthEnabled: boolean;
  supabaseStorageEnabled: boolean;
  africasTalkingUsername: string | null;
  africasTalkingApiKey: string | null;
  africasTalkingFrom: string | null;
  africasTalkingUseSandbox: boolean;
  africasTalkingSmsEnabled: boolean;
  smsSandbox: boolean;
  otpTtlMinutes: number;
  otpRegistrationMessageTemplate: string | null;
  otpLoginMessageTemplate: string | null;
  sessionTtlHours: number;
  notificationRetryCount: number;
  fallbackRoutesEnabled: boolean;
  pesapalConsumerKey: string;
  pesapalConsumerSecret: string;
  pesapalBaseUrl: string;
  pesapalCallbackUrl: string;
  pesapalIpnUrl: string;
  pesapalIpnId: string;
  pesapalUseIframe: boolean;
  paymentsEnabled: boolean;
  devMode: boolean;
  cspDirectives?: string;
}

/** A charge type definition for billing line items. */
export interface ChargeType {
  id: string;
  name: ChargeTypeName;
  displayName: string;
  scope: ChargeTypeScope;
  marketId: string | null;
  isEnabled: boolean;
  updatedBy: string | null;
  updatedByName: string | null;
  updatedAt: string;
  createdAt: string;
}

/** A coordination message exchanged between staff users. */
export interface CoordinationMessage {
  id: string;
  senderUserId: string;
  senderName: string;
  senderRole: Extract<Role, "manager" | "official" | "admin">;
  marketId: string | null;
  marketName: string | null;
  subject: string;
  body: string;
  createdAt: string;
}

/** A resource/budget request submitted by a market manager. */
export interface ResourceRequest {
  id: string;
  managerUserId: string;
  managerName: string;
  marketId: string;
  marketName: string;
  category: ResourceRequestCategory;
  title: string;
  description: string;
  amountRequested: number;
  approvedAmount: number | null;
  status: ResourceRequestStatus;
  reviewNote: string | null;
  reviewedByUserId: string | null;
  reviewedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

/** An activity event displayed on a vendor's activity feed. */
export interface VendorActivityEvent {
  id: string;
  type: "audit" | "booking" | "ticket" | "ticket_update" | "payment" | "notification";
  title: string;
  description: string;
  actorName: string | null;
  actorRole: Role | null;
  status: string | null;
  priority: NotificationPriority;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
