export type Role = "vendor" | "manager" | "official" | "admin";
export const roleOrder: Role[] = ["vendor", "manager", "official", "admin"];
export type Permission =
  | "auth:manage"
  | "billing:read"
  | "billing:manage"
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
export type StallStatus = "active" | "inactive" | "maintenance";
export type BookingStatus = "pending" | "approved" | "rejected" | "paid";
export type PaymentStatus = "pending" | "completed" | "failed";
export type ChargeTypeName = "market_dues" | "utilities" | "penalties" | "booking_fee" | "payment_gateway";
export type ChargeTypeScope = "global" | "market";
export type TicketStatus = "open" | "in_progress" | "resolved";
export type TicketCategory = "billing" | "maintenance" | "dispute" | "other";
export type NotificationType = "otp" | "payment" | "booking" | "complaint" | "system";
export type PaymentMethod = "mtn" | "airtel" | "pesapal";
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

export interface VendorProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  marketId: string | null;
  marketName: string | null;
  status: VendorApprovalStatus;
  approvalReason: string | null;
  idDocument: Attachment | null;
}

export interface ActiveBookingSummary {
  id: string;
  status: BookingStatus;
  amount: number;
}

export interface Stall {
  id: string;
  marketId: string | null;
  marketName: string | null;
  name: string;
  zone: string;
  size: string;
  pricePerMonth: number;
  status: StallStatus;
  isPublished: boolean;
  vendorId: string | null;
  vendorName: string | null;
  activeBooking: ActiveBookingSummary | null;
}

export interface Reservation {
  stallId: string;
  startDate: string;
  endDate: string;
}

export interface Booking {
  id: string;
  marketId: string | null;
  marketName: string | null;
  stallId: string;
  stallName: string;
  stallZone: string;
  vendorId: string;
  vendorName: string;
  status: BookingStatus;
  startDate: string;
  endDate: string;
  amount: number;
  reservedUntil: string | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  reviewedByName: string | null;
}

export interface PaymentAttempt {
  paymentId: string;
  provider: PaymentMethod;
  status: PaymentStatus;
}

export interface Payment {
  id: string;
  marketId: string | null;
  marketName: string | null;
  bookingId: string;
  vendorId: string;
  vendorName: string;
  stallName: string;
  method: PaymentMethod;
  chargeType: ChargeTypeName;
  amount: number;
  status: PaymentStatus;
  transactionId: string | null;
  providerReference: string | null;
  externalReference: string;
  phone: string;
  receiptId: string | null;
  receiptMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface OtpChallenge {
  challengeId: string;
  expiresAt: string;
}

export interface NotificationDelivery {
  id: string;
  channel: "system" | "sms" | "email";
  status: "pending" | "sent" | "failed";
  destination: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  message: string;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface TicketUpdate {
  id: string;
  actorUserId: string;
  actorName: string;
  status: TicketStatus;
  note: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  marketId: string | null;
  marketName: string | null;
  vendorId: string;
  vendorName: string;
  category: TicketCategory;
  subject: string;
  description: string;
  status: TicketStatus;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: Attachment[];
  updates: TicketUpdate[];
}

export interface RevenueReportRow {
  id: string;
  marketId: string | null;
  marketName: string | null;
  createdAt: string;
  vendorName: string;
  amount: number;
  method: PaymentMethod;
  transactionId: string | null;
  status: PaymentStatus;
}

export interface DuesReportRow {
  id: string;
  marketId: string | null;
  marketName: string | null;
  vendorName: string;
  stallName: string;
  amount: number;
  paidAmount: number;
  outstandingAmount: number;
  status: BookingStatus;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  actorUserId: string | null;
  actorName: string;
  actorRole: Role;
  marketId: string | null;
  marketName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown> | null;
  createdAt: string;
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

export interface FinancialAuditRow {
  id: string;
  marketId: string | null;
  marketName: string | null;
  reference: string;
  amount: number;
  depositedAt: string;
}
