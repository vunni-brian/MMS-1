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
export type AnnouncementPriority = "low" | "normal" | "high";
export type AnnouncementAudience = "all" | "vendors" | "staff";
export type PaymentMethod = "mtn" | "airtel" | "pesapal" | "receipt";
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

export interface VendorProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  marketId: string | null;
  marketName: string | null;
  nationalIdNumber: string | null;
  district: string | null;
  productSection: string | null;
  status: VendorApprovalStatus;
  approvalReason: string | null;
  profileImage: Attachment | null;
  idDocument: Attachment | null;
  lcLetter: Attachment | null;
  documentValidation: {
    nationalIdPresent: boolean;
    lcLetterPresent: boolean;
  };
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
  bookingId: string | null;
  utilityChargeId: string | null;
  penaltyId: string | null;
  vendorId: string;
  vendorName: string;
  stallName: string | null;
  description: string | null;
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
  receiptFileName: string | null;
  receiptFilePath: string | null;
  receiptFileMimeType: string | null;
  receiptFileSize: number | null;
  verificationNote: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface UtilityCharge {
  id: string;
  marketId: string;
  marketName: string | null;
  vendorId: string;
  vendorName: string;
  vendorPhone: string;
  bookingId: string | null;
  stallName: string | null;
  utilityType: UtilityType;
  description: string;
  billingPeriod: string;
  usageQuantity: number | null;
  unit: string | null;
  ratePerUnit: number | null;
  calculationMethod: UtilityCalculationMethod;
  amount: number;
  dueDate: string;
  status: UtilityChargeStatus;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  latestPaymentId: string | null;
  latestPaymentStatus: PaymentStatus | null;
  latestPaymentReceiptId: string | null;
  latestPaymentReference: string | null;
  latestPaymentCompletedAt: string | null;
  paymentCount: number;
}

export interface Penalty {
  id: string;
  marketId: string;
  marketName: string | null;
  vendorId: string;
  vendorName: string;
  vendorPhone: string;
  relatedUtilityChargeId: string | null;
  relatedUtilityChargeDescription: string | null;
  amount: number;
  reason: string;
  status: PenaltyStatus;
  issuedBy: string | null;
  issuedByName: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  latestPaymentId: string | null;
  latestPaymentStatus: PaymentStatus | null;
  latestPaymentReceiptId: string | null;
  latestPaymentReference: string | null;
  latestPaymentCompletedAt: string | null;
  paymentCount: number;
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
  priority: NotificationPriority;
  message: string;
  read: boolean;
  readAt: string | null;
  createdAt: string;
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

export interface Announcement {
  id: string;
  marketId: string | null;
  marketName: string | null;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  audience: AnnouncementAudience;
  createdBy: string | null;
  createdByName: string;
  createdByRole: Extract<Role, "manager" | "official" | "admin">;
  expiresAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  active: boolean;
}

export interface TicketUpdate {
  id: string;
  commentNumber: string;
  actorUserId: string;
  actorName: string;
  authorRole: Role;
  status: TicketStatus;
  note: string;
  internal: boolean;
  createdAt: string;
}

export interface TicketAuditLog {
  id: string;
  logNumber: string;
  action: string;
  previousValue: string | null;
  newValue: string | null;
  performedBy: string;
  performedByName: string;
  performedAt: string;
  details: Record<string, unknown> | null;
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  marketId: string | null;
  marketName: string | null;
  vendorId: string;
  vendorName: string;
  assignedTo: string | null;
  assignedToName: string | null;
  priority: TicketPriority;
  category: TicketCategory;
  subject: string;
  description: string;
  status: TicketStatus;
  resolution: string | null;
  slaDueAt: string | null;
  firstResponseAt: string | null;
  breachedSla: boolean;
  resolvedAt: string | null;
  closedAt: string | null;
  escalatedAt: string | null;
  escalationReason: string | null;
  escalationReference: string | null;
  resolutionReference: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: Attachment[];
  updates: TicketUpdate[];
  auditLog: TicketAuditLog[];
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
