import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DASHBOARD_CONFIG } from "@/config/dashboard";
import { formatHumanDateTime } from "@/lib/utils";
import type { AuthUser } from "@/types";
import type { ActivityRow } from "./ActivitySection";

type SettingValue = string | boolean;
type SettingsState = Record<string, SettingValue>;

const defaultSettings: SettingsState = {
  language: "English",
  timeZone: "Africa/Kampala",
  dateFormat: "DD/MM/YYYY",
  currency: "UGX",
  denseTables: true,
  rememberFilters: true,
  paymentReminders: true,
  dashboardHints: false,

  inAppNotifications: true,
  smsNotifications: false,
  emailNotifications: true,
  quietHours: false,
  notifyPayments: true,
  notifyReceipts: true,
  notifyComplaints: true,
  notifyAssignments: true,
  notifyNotices: true,

  twoFactorRequired: false,
  privilegedMfa: true,
  sessionAlerts: true,
  securityEmails: true,
  mfaMethod: "sms",

  defaultPaymentMethod: "mobile-money",
  receiptFormat: "pdf",
  autoDownloadReceipts: true,
  paymentReminderWindow: "3",

  defaultRentCycle: "monthly",
  complaintRouting: "market-manager",
  escalationHours: "48",
  reportAutomation: true,
  assistantDelegation: false,

  slaThreshold: "72",
  occupancyAlerts: true,
  revenueAlerts: true,
  approvalThreshold: "500000",

  systemMode: "production",
  maintenanceMode: false,
  backupEnabled: true,
  backupTime: "02:00",
  backupRetention: "30",

  smtpProvider: "sendgrid",
  fromEmail: "noreply@mms.ug",
  fromName: "MMS Platform",
  smsProvider: "africas-talking",
  senderId: "MMS",
  paymentGateway: "pesapal",
  vendorPaysFee: false,
  platformFeePercent: "0",

  featureComplaints: true,
  featurePayments: true,
  featureStallAllocation: true,
  featureInspections: true,
  featureReports: true,
  featureAssetTracking: false,
  featureGisMapping: false,

  logDebug: false,
  logInfo: true,
  logWarning: true,
  logError: true,
  logRetention: "30",
  auditRetention: "365",
};

const loadStoredSettings = (): SettingsState => {
  if (typeof window === "undefined") {
    return defaultSettings;
  }

  try {
    const stored = window.localStorage.getItem("mms.settings");
    if (!stored) return defaultSettings;
    return { ...defaultSettings, ...(JSON.parse(stored) as SettingsState) };
  } catch {
    return defaultSettings;
  }
};

export function useSettings(user: AuthUser | null) {
  const [settings, setSettings] = useState<SettingsState>(loadStoredSettings);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const canReadAudit = Boolean(user?.permissions?.includes("audit:read"));
  const canReadPayments = Boolean(user?.permissions?.includes("payment:read"));
  const canReadBilling = Boolean(user?.permissions?.includes("billing:read") || user?.permissions?.includes("billing:manage"));
  const canReadNotifications = Boolean(user?.permissions?.includes("notification:read"));

  const notificationsQuery = useQuery({
    queryKey: ["notifications", "settings"],
    queryFn: () => api.getNotifications(8),
    enabled: canReadNotifications,
  });

  const paymentsQuery = useQuery({
    queryKey: ["payments", "settings", user?.marketId],
    queryFn: () => api.getPayments(user?.role === "admin" ? undefined : user?.marketId || undefined),
    enabled: canReadPayments,
  });

  const chargeTypesQuery = useQuery({
    queryKey: ["charge-types", "settings", user?.marketId],
    queryFn: () => api.getChargeTypes(user?.role === "admin" ? undefined : user?.marketId || undefined),
    enabled: canReadBilling,
  });

  const auditQuery = useQuery({
    queryKey: ["audit", "settings", user?.marketId],
    queryFn: () => api.getAudit(user?.role === "admin" ? undefined : user?.marketId || undefined),
    enabled: canReadAudit,
  });

  const marketsQuery = useQuery({
    queryKey: ["markets", "settings"],
    queryFn: () => api.getMarkets(),
    enabled: user?.role === "admin",
  });

  const notifications = notificationsQuery.data?.notifications ?? [];
  const payments = paymentsQuery.data?.payments ?? [];
  const chargeTypes = chargeTypesQuery.data?.chargeTypes ?? [];
  const auditEvents = auditQuery.data?.events ?? [];
  const markets = marketsQuery.data?.markets ?? [];

  const completedPayments = payments.filter((payment) => payment.status === "completed");
  const pendingPayments = payments.filter((payment) => payment.status === "pending");
  const completedPaymentTotal = completedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const paymentGateway = chargeTypes.find((chargeType) => chargeType.name === "payment_gateway");
  const unreadNotifications = notifications.filter((notification) => !notification.read);

  const roleHomePath = user ? `/${user.role}` : "/";

  const activityRows: ActivityRow[] = auditEvents.length
    ? auditEvents.slice(0, 8).map((event) => ({
        id: event.id,
        title: event.action.replace(/_/g, " "),
        detail: `${event.actorName || "System"} - ${event.marketName || "System scope"}`,
        time: formatHumanDateTime(event.createdAt),
      }))
    : notifications.slice(0, 8).map((notification) => ({
        id: notification.id,
        title: notification.type.charAt(0).toUpperCase() + notification.type.slice(1),
        detail: notification.message,
        time: formatHumanDateTime(notification.createdAt),
      }));

  const updateSetting = (key: string, value: SettingValue) => {
    setSettings((current) => {
      const next = { ...current, [key]: value };
      try {
        window.localStorage.setItem("mms.settings", JSON.stringify(next));
      } catch {
        // Settings remain in memory when local storage is unavailable.
      }
      return next;
    });
    setSavedAt(new Date());
  };

  const getBoolean = (key: string) => Boolean(settings[key]);
  const getString = (key: string) => String(settings[key] ?? defaultSettings[key] ?? "");

  return {
    settings,
    updateSetting,
    getBoolean,
    getString,
    savedAt,
    notificationsQuery,
    paymentsQuery,
    chargeTypesQuery,
    auditQuery,
    marketsQuery,
    notifications,
    payments,
    chargeTypes,
    auditEvents,
    markets,
    completedPayments,
    pendingPayments,
    completedPaymentTotal,
    paymentGateway,
    unreadNotifications,
    roleHomePath,
    activityRows,
    canReadAudit,
    canReadPayments,
    canReadBilling,
    canReadNotifications,
  };
}

export type { SettingValue };
