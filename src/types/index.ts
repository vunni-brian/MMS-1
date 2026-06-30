/**
 * Shared type definitions for the MMS application.
 * Includes domain models for markets, stalls, payments, tickets, etc.
 */

/** User roles within the system. */
export type Role = "vendor" | "manager" | "official" | "admin";

/** Ordered list of roles from lowest to highest privilege. */
export const roleOrder: Role[] = ["vendor", "manager", "official", "admin"];

/** Fine-grained action permissions used for authorization. */
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

/** Approval status for vendor applications. */
export type VendorApprovalStatus = "pending" | "approved" | "rejected";

/** Status for staff accounts. */
export type StaffStatus = "active" | "pending" | "suspended";

/** Operational status of a stall. */
export type StallStatus = "active" | "inactive" | "maintenance";

/** Lifecycle status of a stall booking. */
export type BookingStatus = "pending" | "approved" | "rejected" | "paid";

/** Status of a payment transaction. */
export type PaymentStatus = "initiating" | "pending" | "completed" | "failed" | "cancelled";

/** Named charge types used to categorise billing items. */
export const CHARGE_TYPE_NAMES = ["market_dues", "utilities", "penalties", "booking_fee", "payment_gateway"] as const;
export type ChargeTypeName = typeof CHARGE_TYPE_NAMES[number];

/** Scope determining whether a charge type applies globally or per-market. */
export type ChargeTypeScope = "global" | "market";

/** Types of utility services that can be charged. */
export type UtilityType = "electricity" | "water" | "sanitation" | "garbage" | "other";

/** Method used to calculate a utility charge. */
export type UtilityCalculationMethod = "metered" | "estimated" | "fixed";

/** Payment status for utility charges. */
export type UtilityChargeStatus = "unpaid" | "pending" | "pending_payment" | "paid" | "overdue" | "cancelled";

/** Payment status for penalties. */
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
/** Types of in-app notifications. */
export type NotificationType = "otp" | "payment" | "booking" | "complaint" | "system";

/** Priority level for notifications. */
export type NotificationPriority = "low" | "normal" | "high";

/** Priority level for announcements. */
export type AnnouncementPriority = "low" | "normal" | "high";

/** Target audience for an announcement. */
export type AnnouncementAudience = "all" | "vendors" | "staff";

/** Supported payment methods. */
export type PaymentMethod = "mtn" | "airtel" | "pesapal" | "receipt";

/** Category of a resource/budget request. */
export type ResourceRequestCategory = "budget" | "structural";

/** Status of a resource request. */
export type ResourceRequestStatus = "pending" | "approved" | "rejected";

/** Geographic location types used for market hierarchy. */
export type LocationType = "region" | "city" | "district" | "division" | "municipality" | "subcounty" | "market";

/** A market entity with operational statistics. */
export interface Market {
  /** Unique identifier. */
  id: string;
  /** Market display name. */
  name: string;
  /** Market code (short identifier). */
  code: string;
  /** Geographic location description. */
  location: string;
  /** FK to a location record. */
  locationId: string | null;
  /** Human-readable location name. */
  locationName: string | null;
  /** Type of location. */
  locationType: LocationType | null;
  /** FK to a sub-area. */
  subAreaId: string | null;
  /** Sub-area name. */
  subAreaName: string | null;
  /** FK to an area. */
  areaId: string | null;
  /** Area name. */
  areaName: string | null;
  /** FK to a region. */
  regionId: string | null;
  /** Region name. */
  regionName: string | null;
  /** FK to the assigned manager user. */
  managerUserId: string | null;
  /** Manager display name. */
  managerName: string | null;
  /** Number of vendors registered. */
  vendorCount: number;
  /** Total number of stalls. */
  stallCount: number;
  /** Stalls currently active. */
  activeStallCount: number;
  /** Stalls currently inactive. */
  inactiveStallCount: number;
  /** Stalls under maintenance. */
  maintenanceStallCount: number;
}

/** A file attachment stored in the system. */
export interface Attachment {
  /** Unique identifier. */
  id: string;
  /** Original file name. */
  name: string;
  /** MIME type of the file. */
  mimeType: string;
  /** File size in bytes. */
  size: number;
  /** Storage path on the server. */
  storagePath: string;
  /** Upload timestamp. */
  createdAt: string;
}

/** Summary of a market manager for listing purposes. */
export interface MarketManagerSummary {
  /** Manager user ID. */
  id: string;
  /** Manager display name. */
  name: string;
  /** Manager email address. */
  email: string;
  /** Manager phone number. */
  phone: string;
  /** FK to the managed market. */
  marketId: string | null;
  /** Market display name. */
  marketName: string | null;
}

/** Authenticated user session data. */
export interface AuthUser {
  /** User ID. */
  id: string;
  /** Display name. */
  name: string;
  /** Email address. */
  email: string;
  /** Phone number. */
  phone: string;
  /** System role. */
  role: Role;
  /** Permissions granted to this user. */
  permissions: Permission[];
  /** Account creation timestamp. */
  createdAt: string;
  /** Vendor approval status (null for non-vendor roles). */
  vendorStatus: VendorApprovalStatus | null;
  /** When the phone was verified. */
  phoneVerifiedAt: string | null;
  /** FK to the assigned market. */
  marketId: string | null;
  /** Market display name. */
  marketName: string | null;
  /** Profile image attachment. */
  profileImage: Attachment | null;
  /** Product section for vendors. */
  productSection?: string | null;
}

/** Staff account record with role, permissions, and status. */
export interface StaffAccount {
  /** Staff user ID. */
  id: string;
  /** Display name. */
  name: string;
  /** Email address. */
  email: string;
  /** Phone number. */
  phone: string;
  /** System role. */
  role: Role;
  /** Department or unit. */
  department: string | null;
  /** Assigned geographic region. */
  assignedRegion: string | null;
  /** Official staff identifier/number. */
  staffIdentifier: string | null;
  /** Clearance or access level. */
  accessLevel: string;
  /** Account status. */
  status: StaffStatus;
  /** Granted permissions. */
  permissions: Permission[];
  /** List of job responsibilities. */
  responsibilities: string[];
  /** FK to assigned market. */
  marketId: string | null;
  /** Market display name. */
  marketName: string | null;
  /** Account creation timestamp. */
  createdAt: string;
  /** Last activity timestamp. */
  lastActiveAt: string | null;
  /** Vendor approval status. */
  vendorStatus: VendorApprovalStatus | null;
}

/** A vendor profile with application documents and status. */
export interface VendorProfile {
  /** Vendor user ID. */
  id: string;
  /** Vendor display name. */
  name: string;
  /** Email address. */
  email: string;
  /** Phone number. */
  phone: string;
  /** Account creation timestamp. */
  createdAt: string;
  /** FK to assigned market. */
  marketId: string | null;
  /** Market display name. */
  marketName: string | null;
  /** National ID number. */
  nationalIdNumber: string | null;
  /** Home district. */
  district: string | null;
  /** Product/section category. */
  productSection: string | null;
  /** Current approval status. */
  status: VendorApprovalStatus;
  /** Reason given during approval/rejection. */
  approvalReason: string | null;
  /** Profile image attachment. */
  profileImage: Attachment | null;
  /** National ID document attachment. */
  idDocument: Attachment | null;
  /** LC letter attachment. */
  lcLetter: Attachment | null;
  /** Whether required documents are present. */
  documentValidation: {
  /** Whether a national ID has been uploaded. */
  nationalIdPresent: boolean;
  /** Whether an LC letter has been uploaded. */
  lcLetterPresent: boolean;
  };
}

/** Summary of a vendor's active booking for stall listings. */
export interface ActiveBookingSummary {
  /** Booking ID. */
  id: string;
  /** Current booking status. */
  status: BookingStatus;
  /** Booking amount. */
  amount: number;
}

/** A market stall with status, pricing, and assignment info. */
export interface Stall {
  /** Stall ID. */
  id: string;
  /** FK to the market. */
  marketId: string | null;
  /** Market display name. */
  marketName: string | null;
  /** Stall name/number. */
  name: string;
  /** Zone within the market. */
  zone: string;
  /** Size description (e.g., "Large", "5x4"). */
  size: string;
  /** Monthly rental price. */
  pricePerMonth: number;
  /** Operational status. */
  status: StallStatus;
  /** Whether the stall is published for applications. */
  isPublished: boolean;
  /** FK to the assigned vendor. */
  vendorId: string | null;
  /** Vendor display name. */
  vendorName: string | null;
  /** Summary of the vendor's active booking, if any. */
  activeBooking: ActiveBookingSummary | null;
}

/** A booking for a stall by a vendor. */
export interface Booking {
  /** Booking ID. */
  id: string;
  /** FK to the market. */
  marketId: string | null;
  /** Market display name. */
  marketName: string | null;
  /** FK to the stall. */
  stallId: string;
  /** Stall name. */
  stallName: string;
  /** Stall zone. */
  stallZone: string;
  /** FK to the vendor. */
  vendorId: string;
  /** Vendor display name. */
  vendorName: string;
  /** Current booking status. */
  status: BookingStatus;
  /** Booking start date. */
  startDate: string;
  /** Booking end date. */
  endDate: string;
  /** Total amount due. */
  amount: number;
  /** Date until which the stall is reserved. */
  reservedUntil: string | null;
  /** Booking creation timestamp. */
  createdAt: string;
  /** Last update timestamp. */
  updatedAt: string;
  /** Confirmation timestamp. */
  confirmedAt: string | null;
  /** Review timestamp. */
  reviewedAt: string | null;
  /** Review notes from the approving official. */
  reviewNote: string | null;
  /** Name of the reviewer. */
  reviewedByName: string | null;
}

/** A single payment attempt record. */
export interface PaymentAttempt {
  /** FK to the payment. */
  paymentId: string;
  /** Payment provider used. */
  provider: PaymentMethod;
  /** Outcome status. */
  status: PaymentStatus;
}

/** A payment transaction. */
export interface Payment {
  /** Payment ID. */
  id: string;
  /** FK to the market. */
  marketId: string | null;
  /** Market display name. */
  marketName: string | null;
  /** FK to a related booking. */
  bookingId: string | null;
  /** FK to a related utility charge. */
  utilityChargeId: string | null;
  /** FK to a related penalty. */
  penaltyId: string | null;
  /** FK to the vendor. */
  vendorId: string;
  /** Vendor display name. */
  vendorName: string;
  /** Stall name from the related booking. */
  stallName: string | null;
  /** Payment description. */
  description: string | null;
  /** Payment method used. */
  method: PaymentMethod;
  /** Charge type category. */
  chargeType: ChargeTypeName;
  /** Amount paid. */
  amount: number;
  /** Current status. */
  status: PaymentStatus;
  /** Payment gateway transaction ID. */
  transactionId: string | null;
  /** Provider-side reference. */
  providerReference: string | null;
  /** External reference number. */
  externalReference: string;
  /** Payer phone number. */
  phone: string;
  /** Uploaded receipt ID. */
  receiptId: string | null;
  /** Message from receipt upload. */
  receiptMessage: string | null;
  /** Receipt file name. */
  receiptFileName: string | null;
  /** Receipt file path. */
  receiptFilePath: string | null;
  /** Receipt file MIME type. */
  receiptFileMimeType: string | null;
  /** Receipt file size in bytes. */
  receiptFileSize: number | null;
  /** Note from payment verification. */
  verificationNote: string | null;
  /** Payment creation timestamp. */
  createdAt: string;
  /** Last update timestamp. */
  updatedAt: string;
  /** Completion timestamp. */
  completedAt: string | null;
}

/** A utility charge (e.g., electricity, water, sanitation) applied to a vendor. */
export interface UtilityCharge {
  /** Utility charge ID. */
  id: string;
  /** FK to the market. */
  marketId: string;
  /** Market display name. */
  marketName: string | null;
  /** FK to the vendor. */
  vendorId: string;
  /** Vendor display name. */
  vendorName: string;
  /** Vendor phone number. */
  vendorPhone: string;
  /** FK to a related booking. */
  bookingId: string | null;
  /** Stall name. */
  stallName: string | null;
  /** Type of utility. */
  utilityType: UtilityType;
  /** Description of the charge. */
  description: string;
  /** Billing period label (e.g., "2026-04"). */
  billingPeriod: string;
  /** Usage quantity for metered charges. */
  usageQuantity: number | null;
  /** Unit of measurement. */
  unit: string | null;
  /** Rate per unit for metered charges. */
  ratePerUnit: number | null;
  /** Calculation method. */
  calculationMethod: UtilityCalculationMethod;
  /** Total amount charged. */
  amount: number;
  /** Payment due date. */
  dueDate: string;
  /** Current payment status. */
  status: UtilityChargeStatus;
  /** FK to the user who created this charge. */
  createdBy: string | null;
  /** Creator display name. */
  createdByName: string | null;
  /** Creation timestamp. */
  createdAt: string;
  /** Last update timestamp. */
  updatedAt: string;
  /** Payment completion timestamp. */
  paidAt: string | null;
  /** FK to the most recent related payment. */
  latestPaymentId: string | null;
  /** Status of the most recent payment. */
  latestPaymentStatus: PaymentStatus | null;
  /** Receipt ID of the most recent payment. */
  latestPaymentReceiptId: string | null;
  /** Reference of the most recent payment. */
  latestPaymentReference: string | null;
  /** Completion date of the most recent payment. */
  latestPaymentCompletedAt: string | null;
  /** Number of payments made against this charge. */
  paymentCount: number;
}

/** A penalty issued to a vendor for violations. */
export interface Penalty {
  /** Penalty ID. */
  id: string;
  /** FK to the market. */
  marketId: string;
  /** Market display name. */
  marketName: string | null;
  /** FK to the vendor. */
  vendorId: string;
  /** Vendor display name. */
  vendorName: string;
  /** Vendor phone number. */
  vendorPhone: string;
  /** FK to a related utility charge. */
  relatedUtilityChargeId: string | null;
  /** Description of the related utility charge. */
  relatedUtilityChargeDescription: string | null;
  /** Penalty amount. */
  amount: number;
  /** Reason for the penalty. */
  reason: string;
  /** Current payment status. */
  status: PenaltyStatus;
  /** FK to the user who issued the penalty. */
  issuedBy: string | null;
  /** Issuer display name. */
  issuedByName: string | null;
  /** Creation timestamp. */
  createdAt: string;
  /** Last update timestamp. */
  updatedAt: string;
  /** Payment completion timestamp. */
  paidAt: string | null;
  /** FK to the most recent related payment. */
  latestPaymentId: string | null;
  /** Status of the most recent payment. */
  latestPaymentStatus: PaymentStatus | null;
  /** Receipt ID of the most recent payment. */
  latestPaymentReceiptId: string | null;
  /** Reference of the most recent payment. */
  latestPaymentReference: string | null;
  /** Completion date of the most recent payment. */
  latestPaymentCompletedAt: string | null;
  /** Number of payments made against this penalty. */
  paymentCount: number;
}

/** An OTP verification challenge. */
export interface OtpChallenge {
  /** Unique challenge identifier. */
  challengeId: string;
  /** Challenge expiry timestamp. */
  expiresAt: string;
}

/** Delivery record for a notification. */
export interface NotificationDelivery {
  /** Delivery record ID. */
  id: string;
  /** Delivery channel used. */
  channel: "system" | "sms" | "email";
  /** Delivery status. */
  status: "pending" | "sent" | "failed";
  /** Destination address (phone, email, or user ID). */
  destination: string;
}

/** An in-app notification for a user. */
export interface AppNotification {
  /** Notification ID. */
  id: string;
  /** FK to the recipient user. */
  userId: string;
  /** Notification type. */
  type: NotificationType;
  /** Priority level. */
  priority: NotificationPriority;
  /** Notification body text. */
  message: string;
  /** Whether the notification has been read. */
  read: boolean;
  /** Timestamp when read. */
  readAt: string | null;
  /** Creation timestamp. */
  createdAt: string;
}

/** An event in a vendor's activity feed. */
export interface VendorActivityEvent {
  /** Event ID. */
  id: string;
  /** Type of event. */
  type: "audit" | "booking" | "ticket" | "ticket_update" | "payment" | "notification";
  /** Event title. */
  title: string;
  /** Event description. */
  description: string;
  /** Name of the acting user. */
  actorName: string | null;
  /** Role of the acting user. */
  actorRole: Role | null;
  /** Related entity status. */
  status: string | null;
  /** Notification priority level. */
  priority: NotificationPriority;
  /** Arbitrary metadata payload. */
  metadata: Record<string, unknown> | null;
  /** Event timestamp. */
  createdAt: string;
}

/** A published announcement targeted at vendors or staff. */
export interface Announcement {
  /** Announcement ID. */
  id: string;
  /** FK to the target market (null for all markets). */
  marketId: string | null;
  /** Market display name. */
  marketName: string | null;
  /** Announcement title. */
  title: string;
  /** Announcement body text. */
  body: string;
  /** Priority level. */
  priority: AnnouncementPriority;
  /** Target audience. */
  audience: AnnouncementAudience;
  /** FK to the creator user. */
  createdBy: string | null;
  /** Creator display name. */
  createdByName: string;
  /** Role of the creator. */
  createdByRole: Extract<Role, "manager" | "official" | "admin">;
  /** Expiry timestamp (null if never expires). */
  expiresAt: string | null;
  /** Archival timestamp. */
  archivedAt: string | null;
  /** Creation timestamp. */
  createdAt: string;
  /** Last update timestamp. */
  updatedAt: string;
  /** Whether the announcement is currently active. */
  active: boolean;
}

/** An update or comment on a support ticket. */
export interface TicketUpdate {
  /** Update ID. */
  id: string;
  /** Human-readable comment number. */
  commentNumber: string;
  /** FK to the acting user. */
  actorUserId: string;
  /** Actor display name. */
  actorName: string;
  /** Role of the author. */
  authorRole: Role;
  /** Ticket status at the time of the update. */
  status: TicketStatus;
  /** Update note content. */
  note: string;
  /** Whether this note is internal (not visible to the vendor). */
  internal: boolean;
  /** Creation timestamp. */
  createdAt: string;
}

/** A logged action in a ticket's audit trail. */
export interface TicketAuditLog {
  /** Log entry ID. */
  id: string;
  /** Human-readable log number. */
  logNumber: string;
  /** Description of the action performed. */
  action: string;
  /** Previous value before the change. */
  previousValue: string | null;
  /** New value after the change. */
  newValue: string | null;
  /** FK to the performing user. */
  performedBy: string;
  /** Performer display name. */
  performedByName: string;
  /** Action timestamp. */
  performedAt: string;
  /** Arbitrary details about the action. */
  details: Record<string, unknown> | null;
}

/** A support ticket with full audit trail and updates. */
export interface Ticket {
  /** Ticket ID. */
  id: string;
  /** Human-readable ticket number. */
  ticketNumber: string;
  /** FK to the market. */
  marketId: string | null;
  /** Market display name. */
  marketName: string | null;
  /** FK to the vendor who opened the ticket. */
  vendorId: string;
  /** Vendor display name. */
  vendorName: string;
  /** FK to the assigned staff user. */
  assignedTo: string | null;
  /** Assignee display name. */
  assignedToName: string | null;
  /** Priority level. */
  priority: TicketPriority;
  /** Category. */
  category: TicketCategory;
  /** Ticket subject. */
  subject: string;
  /** Detailed description. */
  description: string;
  /** Current status. */
  status: TicketStatus;
  /** Resolution summary. */
  resolution: string | null;
  /** SLA deadline timestamp. */
  slaDueAt: string | null;
  /** First response timestamp. */
  firstResponseAt: string | null;
  /** Whether the SLA has been breached. */
  breachedSla: boolean;
  /** Resolution timestamp. */
  resolvedAt: string | null;
  /** Closure timestamp. */
  closedAt: string | null;
  /** Escalation timestamp. */
  escalatedAt: string | null;
  /** Reason for escalation. */
  escalationReason: string | null;
  /** External escalation reference. */
  escalationReference: string | null;
  /** External resolution reference. */
  resolutionReference: string | null;
  /** Creation timestamp. */
  createdAt: string;
  /** Last update timestamp. */
  updatedAt: string;
  /** File attachments. */
  attachments: Attachment[];
  /** Status updates and comments. */
  updates: TicketUpdate[];
  /** Audit trail entries. */
  auditLog: TicketAuditLog[];
}

/** A row in a revenue report. */
export interface RevenueReportRow {
  /** Payment ID. */
  id: string;
  /** FK to the market. */
  marketId: string | null;
  /** Market display name. */
  marketName: string | null;
  /** Payment date. */
  createdAt: string;
  /** Vendor display name. */
  vendorName: string;
  /** Payment amount. */
  amount: number;
  /** Payment method used. */
  method: PaymentMethod;
  /** Payment gateway transaction ID. */
  transactionId: string | null;
  /** Payment status. */
  status: PaymentStatus;
}

/** A row in a dues/outstanding report. */
export interface DuesReportRow {
  /** Booking ID. */
  id: string;
  /** FK to the market. */
  marketId: string | null;
  /** Market display name. */
  marketName: string | null;
  /** Vendor display name. */
  vendorName: string;
  /** Stall name. */
  stallName: string;
  /** Total amount due. */
  amount: number;
  /** Amount paid so far. */
  paidAmount: number;
  /** Remaining outstanding amount. */
  outstandingAmount: number;
  /** Current booking status. */
  status: BookingStatus;
  /** Booking creation date. */
  createdAt: string;
}

/** An audit event tracking a system action. */
export interface AuditEvent {
  /** Event ID. */
  id: string;
  /** FK to the acting user. */
  actorUserId: string | null;
  /** Actor display name. */
  actorName: string;
  /** Role of the actor. */
  actorRole: Role;
  /** FK to the market context. */
  marketId: string | null;
  /** Market display name. */
  marketName: string | null;
  /** Description of the action. */
  action: string;
  /** Type of entity affected. */
  entityType: string;
  /** FK to the affected entity. */
  entityId: string;
  /** Arbitrary action details. */
  details: Record<string, unknown> | null;
  /** Event timestamp. */
  createdAt: string;
}

/** A coordination message exchanged between staff roles. */
export interface CoordinationMessage {
  /** Message ID. */
  id: string;
  /** FK to the sender. */
  senderUserId: string;
  /** Sender display name. */
  senderName: string;
  /** Role of the sender. */
  senderRole: Extract<Role, "manager" | "official" | "admin">;
  /** FK to the related market. */
  marketId: string | null;
  /** Market display name. */
  marketName: string | null;
  /** Message subject. */
  subject: string;
  /** Message body. */
  body: string;
  /** Sent timestamp. */
  createdAt: string;
}

/** A charge type configuration (e.g., market dues, utilities). */
export interface ChargeType {
  /** Charge type ID. */
  id: string;
  /** System name. */
  name: ChargeTypeName;
  /** Human-readable display name. */
  displayName: string;
  /** Scope (global or per-market). */
  scope: ChargeTypeScope;
  /** FK to the market for market-scoped charges. */
  marketId: string | null;
  /** Whether this charge type is currently enabled. */
  isEnabled: boolean;
  /** FK to the user who last updated it. */
  updatedBy: string | null;
  /** Updater display name. */
  updatedByName: string | null;
  /** Last update timestamp. */
  updatedAt: string;
}

/** A resource/budget request from a manager to an official. */
export interface ResourceRequest {
  /** Request ID. */
  id: string;
  /** FK to the requesting manager. */
  managerUserId: string;
  /** Manager display name. */
  managerName: string;
  /** FK to the market. */
  marketId: string;
  /** Market display name. */
  marketName: string;
  /** Category of the request. */
  category: ResourceRequestCategory;
  /** Request title. */
  title: string;
  /** Detailed description. */
  description: string;
  /** Amount of funding requested. */
  amountRequested: number;
  /** Amount approved (null if not yet reviewed). */
  approvedAmount: number | null;
  /** Current status. */
  status: ResourceRequestStatus;
  /** Review notes from the approver. */
  reviewNote: string | null;
  /** FK to the reviewer user. */
  reviewedByUserId: string | null;
  /** Reviewer display name. */
  reviewedByName: string | null;
  /** Creation timestamp. */
  createdAt: string;
  /** Last update timestamp. */
  updatedAt: string;
}

/** A row in a financial audit report comparing collected vs deposited amounts. */
export interface FinancialAuditRow {
  /** Row ID. */
  id: string;
  /** FK to the market. */
  marketId: string | null;
  /** Market display name. */
  marketName: string | null;
  /** Reference identifier (e.g., transaction or deposit ID). */
  reference: string;
  /** Amount involved. */
  amount: number;
  /** Deposit timestamp. */
  depositedAt: string;
}
