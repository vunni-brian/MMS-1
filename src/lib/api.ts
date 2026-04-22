import type {
  AppNotification,
  Attachment,
  AuditEvent,
  AuthUser,
  Booking,
  ChargeType,
  CoordinationMessage,
  DuesReportRow,
  FinancialAuditRow,
  Market,
  Penalty,
  Payment,
  PaymentMethod,
  ResourceRequest,
  ResourceRequestCategory,
  RevenueReportRow,
  Stall,
  Ticket,
  TicketCategory,
  TicketStatus,
  UtilityCalculationMethod,
  UtilityCharge,
  UtilityType,
  VendorProfile,
} from "@/types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
const SESSION_TOKEN_KEY = "mms.session.token";

export class ApiError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

const parseResponse = async <T>(response: Response): Promise<T> => {
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;
  if (!response.ok) {
    throw new ApiError(payload?.error || "Request failed.", response.status, payload?.details);
  }
  return payload as T;
};

const createHeaders = (token?: string | null, hasJsonBody = true) => {
  const headers = new Headers();
  if (hasJsonBody) {
    headers.set("Content-Type", "application/json");
  }
  const sessionToken = token ?? getSessionToken();
  if (sessionToken) {
    headers.set("Authorization", `Bearer ${sessionToken}`);
  }
  return headers;
};

export const getSessionToken = () => window.localStorage.getItem(SESSION_TOKEN_KEY);
export const setSessionToken = (token: string) => window.localStorage.setItem(SESSION_TOKEN_KEY, token);
export const clearSessionToken = () => window.localStorage.removeItem(SESSION_TOKEN_KEY);

const buildQuery = (params: Record<string, string | null | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      search.set(key, value);
    }
  });
  const query = search.toString();
  return query ? `?${query}` : "";
};

const apiRequest = async <T>(path: string, init: RequestInit = {}) => {
  const hasJsonBody = init.body ? !(init.body instanceof FormData) : true;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: init.headers || createHeaders(undefined, hasJsonBody),
  });
  return parseResponse<T>(response);
};

const toFilePayload = async (file: File): Promise<{
  name: string;
  mimeType: string;
  size: number;
  base64: string;
}> => {
  const arrayBuffer = await file.arrayBuffer();
  let binary = "";
  new Uint8Array(arrayBuffer).forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return {
    name: file.name,
    mimeType: file.type,
    size: file.size,
    base64: btoa(binary),
  };
};

export const api = {
  health: () => apiRequest<{ ok: boolean }>("/health"),

  async registerVendor(input: {
    name: string;
    email: string;
    phone: string;
    password: string;
    marketId: string;
    nationalIdNumber: string;
    district: string;
    idDocument: File;
    lcLetter: File;
  }) {
    const { idDocument, lcLetter, ...payload } = input;
    return apiRequest<{
      challengeId: string;
      expiresAt: string;
      status: string;
    }>("/auth/register-vendor", {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        idDocument: await toFilePayload(idDocument),
        lcLetter: await toFilePayload(lcLetter),
      }),
    });
  },

  verifyRegistrationOtp: (challengeId: string, code: string) =>
    apiRequest<{ status: string; message: string }>("/auth/verify-registration-otp", {
      method: "POST",
      body: JSON.stringify({ challengeId, code }),
    }),

  login: (phone: string, password: string) =>
    apiRequest<
      | { verificationRequired: true; challengeId: string; expiresAt: string }
      | { mfaRequired: true; challengeId: string; expiresAt: string }
      | { token: string; user: AuthUser }
    >("/auth/login", {
      method: "POST",
      body: JSON.stringify({ phone, password }),
    }),

  createManager: (input: {
    name: string;
    email: string;
    phone: string;
    marketId: string;
  }) =>
    apiRequest<{ manager: AuthUser; message: string }>("/auth/managers", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  verifyPrivilegedMfa: (challengeId: string, code: string) =>
    apiRequest<{ token: string; user: AuthUser }>("/auth/verify-privileged-mfa", {
      method: "POST",
      body: JSON.stringify({ challengeId, code }),
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiRequest<{ message: string }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  updateMyProfile: (input: { name: string; email: string; phone: string }) =>
    apiRequest<{ user: AuthUser; message: string }>("/auth/me", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  logout: () => apiRequest<void>("/auth/logout", { method: "POST" }),
  getMe: () => apiRequest<{ user: AuthUser }>("/auth/me"),
  getMarkets: () => apiRequest<{ markets: Market[] }>("/markets"),
  getChargeTypes: (marketId?: string) =>
    apiRequest<{ chargeTypes: ChargeType[] }>(`/billing/charge-types${buildQuery({ marketId })}`),
  updateChargeType: (chargeTypeId: string, isEnabled: boolean) =>
    apiRequest<{ chargeType: ChargeType }>(`/billing/charge-types/${chargeTypeId}`, {
      method: "PATCH",
      body: JSON.stringify({ isEnabled }),
    }),

  getVendors: (marketId?: string) => apiRequest<{ vendors: VendorProfile[] }>(`/vendors${buildQuery({ marketId })}`),
  getVendor: (vendorId: string) => apiRequest<{ vendor: VendorProfile }>(`/vendors/${vendorId}`),
  updateVendorProfile: (
    vendorId: string,
    input: {
      name: string;
      email: string;
      phone: string;
      marketId: string;
    },
  ) =>
    apiRequest<{ vendor: VendorProfile; message: string }>(`/vendors/${vendorId}/profile`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  approveVendor: (vendorId: string, notes?: string) =>
    apiRequest<{ vendor: VendorProfile }>(`/vendors/${vendorId}/approve`, {
      method: "POST",
      body: JSON.stringify({ notes }),
    }),
  rejectVendor: (vendorId: string, reason: string) =>
    apiRequest<{ vendor: VendorProfile }>(`/vendors/${vendorId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  resetVendorPassword: (vendorId: string, reason: string) =>
    apiRequest<{ message: string }>(`/vendors/${vendorId}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  getVendorDocumentUrl: async (vendorId: string, documentType: "national-id" | "lc-letter") => {
    const response = await fetch(`${API_BASE_URL}/vendors/${vendorId}/documents/${documentType}`, {
      headers: createHeaders(undefined, false),
    });
    if (!response.ok) {
      const isJson = response.headers.get("content-type")?.includes("application/json");
      const payload = isJson ? await response.json() : null;
      throw new ApiError(payload?.error || "Unable to load document.", response.status, payload?.details);
    }
    return URL.createObjectURL(await response.blob());
  },

  getStalls: (options?: { zone?: string; marketId?: string; scope?: "mine" }) =>
    apiRequest<{ stalls: Stall[] }>(`/stalls${buildQuery({ zone: options?.zone, marketId: options?.marketId, scope: options?.scope })}`),
  createStall: (input: {
    name: string;
    zone: string;
    size: string;
    pricePerMonth: number;
    isPublished?: boolean;
  }) =>
    apiRequest<{ stall: Stall }>("/stalls", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateStall: (stallId: string, input: Partial<Pick<Stall, "name" | "zone" | "size" | "status" | "pricePerMonth" | "isPublished">>) =>
    apiRequest<{ stall: Stall }>(`/stalls/${stallId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  reserveStall: (stallId: string, input: { startDate?: string; endDate?: string }) =>
    apiRequest<{ booking: Booking }>(`/stalls/${stallId}/reservations`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getBookings: (marketId?: string) => apiRequest<{ bookings: Booking[] }>(`/bookings${buildQuery({ marketId })}`),
  approveBooking: (bookingId: string, reviewNote?: string) =>
    apiRequest<{ booking: Booking }>(`/bookings/${bookingId}/approve`, {
      method: "POST",
      body: JSON.stringify({ reviewNote }),
    }),
  rejectBooking: (bookingId: string, reason: string) =>
    apiRequest<{ booking: Booking }>(`/bookings/${bookingId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  markBookingPaid: (bookingId: string, transactionId?: string) =>
    apiRequest<{ booking: Booking }>(`/bookings/${bookingId}/mark-paid`, {
      method: "POST",
      body: JSON.stringify({ transactionId }),
    }),

  initiatePayment: (input: { bookingId?: string | null; utilityChargeId?: string | null; penaltyId?: string | null }) =>
    apiRequest<{
      payment: Payment;
      status: string;
      message: string;
      redirectUrl: string;
      orderTrackingId: string;
      iframe: boolean;
    }>("/payments/initiate", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getPesapalCallbackStatus: (orderTrackingId: string, merchantReference: string) =>
    apiRequest<{ ok: true; payment: Payment | null }>(
      `/payments/pesapal/callback-status${buildQuery({
        OrderTrackingId: orderTrackingId,
        OrderMerchantReference: merchantReference,
      })}`,
    ),
  getPayments: (marketId?: string) => apiRequest<{ payments: Payment[] }>(`/payments${buildQuery({ marketId })}`),
  getUtilityCharges: (options?: { marketId?: string; status?: string }) =>
    apiRequest<{ utilityCharges: UtilityCharge[] }>(
      `/utility-charges${buildQuery({ marketId: options?.marketId, status: options?.status })}`,
    ),
  createUtilityCharge: (input: {
    marketId?: string;
    vendorId: string;
    bookingId?: string | null;
    utilityType: UtilityType;
    description: string;
    billingPeriod: string;
    usageQuantity?: number | null;
    unit?: string | null;
    ratePerUnit?: number | null;
    calculationMethod: UtilityCalculationMethod;
    amount?: number | null;
    dueDate: string;
  }) =>
    apiRequest<{ utilityCharge: UtilityCharge }>("/utility-charges", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  cancelUtilityCharge: (utilityChargeId: string) =>
    apiRequest<{ utilityCharge: UtilityCharge }>(`/utility-charges/${utilityChargeId}/cancel`, {
      method: "POST",
    }),
  getPenalties: (options?: { marketId?: string; status?: string }) =>
    apiRequest<{ penalties: Penalty[] }>(`/penalties${buildQuery({ marketId: options?.marketId, status: options?.status })}`),
  createPenalty: (input: {
    marketId?: string;
    vendorId: string;
    relatedUtilityChargeId?: string | null;
    amount: number;
    reason: string;
  }) =>
    apiRequest<{ penalty: Penalty }>("/penalties", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  cancelPenalty: (penaltyId: string) =>
    apiRequest<{ penalty: Penalty }>(`/penalties/${penaltyId}/cancel`, {
      method: "POST",
    }),
  getReceipt: (paymentId: string) =>
    apiRequest<{
      receipt: {
        paymentId: string;
        receiptId: string | null;
        message: string | null;
        transactionId: string | null;
        amount: number;
        createdAt: string;
      };
    }>(`/payments/${paymentId}/receipt`),

  getNotifications: (limit?: number) =>
    apiRequest<{ notifications: AppNotification[] }>(`/notifications${limit ? `?limit=${limit}` : ""}`),
  markNotificationRead: (notificationId: string) =>
    apiRequest<{ ok: true }>(`/notifications/${notificationId}/read`, { method: "PATCH" }),

  getTickets: (marketId?: string) => apiRequest<{ tickets: Ticket[] }>(`/tickets${buildQuery({ marketId })}`),
  async createTicket(input: {
    category: TicketCategory;
    subject: string;
    description: string;
    attachment?: File | null;
  }) {
    const attachment = input.attachment ? await toFilePayload(input.attachment) : null;
    return apiRequest<{ ticket: Ticket }>("/tickets", {
      method: "POST",
      body: JSON.stringify({ ...input, attachment }),
    });
  },
  updateTicket: (ticketId: string, input: { status?: TicketStatus; resolutionNote?: string; note?: string }) =>
    apiRequest<{ ticket: Ticket }>(`/tickets/${ticketId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  getRevenueReport: (from: string, to: string, marketId?: string) =>
    apiRequest<{
      summary: { from: string; to: string; totalRevenue: number; transactionCount: number };
      rows: RevenueReportRow[];
    }>(`/reports/revenue${buildQuery({ from, to, marketId })}`),
  getDuesReport: (from: string, to: string, marketId?: string) =>
    apiRequest<{
      summary: { from: string; to: string; outstandingTotal: number; bookingCount: number };
      rows: DuesReportRow[];
    }>(`/reports/dues${buildQuery({ from, to, marketId })}`),
  getAudit: (marketId?: string) => apiRequest<{ events: AuditEvent[] }>(`/audit${buildQuery({ marketId })}`),
  getFinancialAudit: (from?: string, to?: string, marketId?: string) =>
    apiRequest<{
      summary: { from: string; to: string; collectedTotal: number; depositedTotal: number; variance: number };
      rows: FinancialAuditRow[];
    }>(`/reports/financial-audit${buildQuery({ from, to, marketId })}`),

  getCoordinationMessages: (marketId?: string) =>
    apiRequest<{ messages: CoordinationMessage[] }>(`/coordination/messages${buildQuery({ marketId })}`),
  postCoordinationMessage: (subject: string, body: string, marketId?: string | null) =>
    apiRequest<{ message: CoordinationMessage }>("/coordination/messages", {
      method: "POST",
      body: JSON.stringify({ subject, body, marketId: marketId ?? null }),
    }),
  getResourceRequests: (marketId?: string) =>
    apiRequest<{ requests: ResourceRequest[] }>(`/resource-requests${buildQuery({ marketId })}`),
  createResourceRequest: (input: {
    category: ResourceRequestCategory;
    title: string;
    description: string;
    amountRequested: number;
  }) =>
    apiRequest<{ request: ResourceRequest }>("/resource-requests", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  reviewResourceRequest: (
    requestId: string,
    input: {
      status: "approved" | "rejected";
      reviewNote?: string;
      approvedAmount?: number | null;
    },
  ) =>
    apiRequest<{ request: ResourceRequest }>(`/resource-requests/${requestId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  simulateUssd: (phone: string, input: string) =>
    apiRequest<{ response: string }>("/fallback/ussd", {
      method: "POST",
      body: JSON.stringify({ phone, input }),
    }),
  simulateSms: (phone: string, message: string) =>
    apiRequest<{ response: string }>("/fallback/sms", {
      method: "POST",
      body: JSON.stringify({ phone, message }),
    }),
};

export const formatAttachmentLabel = (attachment: Attachment | null) => {
  if (!attachment) {
    return "No file uploaded";
  }
  return `${attachment.name} (${Math.round(attachment.size / 1024)} KB)`;
};
