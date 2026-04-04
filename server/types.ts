export type Role = "vendor" | "manager" | "official";

export type Permission =
  | "auth:manage"
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
  | "ticket:read"
  | "ticket:create"
  | "ticket:update"
  | "report:read"
  | "audit:read"
  | "fallback:query";

export type VendorApprovalStatus = "pending" | "approved" | "rejected";
export type StallStatus = "available" | "reserved" | "paid" | "confirmed" | "maintenance";
export type BookingStatus = "reserved" | "paid" | "confirmed";
export type PaymentStatus = "pending" | "completed" | "failed";
export type PaymentProvider = "mtn" | "airtel";
export type TicketStatus = "open" | "in_progress" | "resolved";
export type TicketCategory = "billing" | "maintenance" | "dispute" | "other";
export type NotificationType = "otp" | "payment" | "booking" | "complaint" | "system";
export type NotificationChannel = "system" | "sms" | "email";
export type OtpPurpose = "registration" | "manager_mfa";
export type ResourceRequestCategory = "budget" | "structural";
export type ResourceRequestStatus = "pending" | "approved" | "rejected";

export interface Market {
  id: string;
  name: string;
  code: string;
  location: string;
  managerUserId: string | null;
  managerName: string | null;
  vendorCount: number;
  stallCount: number;
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
  twilioAccountSid: string | null;
  twilioAuthToken: string | null;
  twilioPhoneNumber: string | null;
  twilioSmsEnabled: boolean;
  otpTtlMinutes: number;
  sessionTtlHours: number;
  notificationRetryCount: number;
  paymentSettlementDelayMs: number;
  devMode: boolean;
}

export interface CoordinationMessage {
  id: string;
  senderUserId: string;
  senderName: string;
  senderRole: Extract<Role, "manager" | "official">;
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
