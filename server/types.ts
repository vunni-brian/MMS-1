export type Role = "vendor" | "manager" | "official" | "admin";
export const roleOrder: Role[] = ["vendor", "manager", "official", "admin"];

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

export type VendorApprovalStatus = "pending" | "approved" | "rejected";
export type StaffStatus = "active" | "pending" | "suspended";
export type StallStatus = "active" | "inactive" | "maintenance";
export type BookingStatus = "pending" | "approved" | "rejected" | "paid";
export type PaymentStatus = "pending" | "completed" | "failed" | "cancelled";
export type PaymentProvider = "mtn" | "airtel" | "pesapal";
export type ChargeTypeName = "market_dues" | "utilities" | "penalties" | "booking_fee" | "payment_gateway";
export type ChargeTypeScope = "global" | "market";
export type UtilityType = "electricity" | "water" | "sanitation" | "garbage" | "other";
export type UtilityCalculationMethod = "metered" | "estimated" | "fixed";
export type UtilityChargeStatus = "unpaid" | "pending" | "pending_payment" | "paid" | "overdue" | "cancelled";
export type PenaltyStatus = "unpaid" | "pending" | "pending_payment" | "paid" | "cancelled";
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketCategory =
  | "billing"
  | "maintenance"
  | "dispute"
  | "payment"
  | "stall"
  | "sanitation"
  | "harassment"
  | "other";
export type NotificationType = "otp" | "payment" | "booking" | "complaint" | "system";
export type NotificationPriority = "low" | "normal" | "high";
export type NotificationChannel = "system" | "sms" | "email";
export type OtpPurpose = "registration" | "manager_mfa";
export type ResourceRequestCategory = "budget" | "structural";
export type ResourceRequestStatus = "pending" | "approved" | "rejected";
export type LocationType = "region" | "city" | "district" | "division" | "municipality" | "subcounty" | "market";

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

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  storagePath: string;
  createdAt: string;
}

export interface MarketManagerSummary {
  id: string;
  name: string;
  email: string;
  phone: string;
  marketId: string | null;
  marketName: string | null;
}

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

export interface SessionAuth {
  token: string;
  user: AuthUser;
}

export interface FilePayload {
  name: string;
  mimeType: string;
  size: number;
  base64: string;
}

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
  paymentSettlementDelayMs: number;
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
}

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
}

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
