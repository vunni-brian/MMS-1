/**
 * Root application component and route definitions for MMS.
 *
 * Sets up React Query, React Router, auth context, and lazy-loaded
 * role-based route trees for admin, manager, official, and vendor users.
 */
import { lazy, Suspense } from "react";
import Index from "./pages/Index";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/contexts/AuthContext";
import "@/lib/i18n";
import { ProtectedRoute, VendorApprovalGuard, RoleRoute } from "@/components/ProtectedRoute";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { SpeedInsights } from "@vercel/speed-insights/react";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const PaymentCallbackPage = lazy(() => import("./pages/PaymentCallbackPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const AppLayout = lazy(() => import("./components/AppLayout"));
const VendorDashboard = lazy(() => import("./pages/vendor/VendorDashboard"));
const ManagerDashboard = lazy(() => import("./pages/manager/ManagerDashboard"));
const OfficialDashboard = lazy(() => import("./pages/official/OfficialDashboard"));
const OfficialMarketsPage = lazy(() =>
 import("./pages/official/OversightPages").then((module) => ({ default: module.OfficialMarketsPage })),
);
const OfficialVendorDirectoryPage = lazy(() =>
 import("./pages/official/OversightPages").then((module) => ({ default: module.OfficialVendorDirectoryPage })),
);
const OfficialCompliancePage = lazy(() =>
 import("./pages/official/OversightPages").then((module) => ({ default: module.OfficialCompliancePage })),
);
const OfficialAnalyticsPage = lazy(() =>
 import("./pages/official/OversightPages").then((module) => ({ default: module.OfficialAnalyticsPage })),
);
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const UserManagementPage = lazy(() => import("./pages/admin/UserManagementPage"));
const AdminMarketsPage = lazy(() => import("./pages/admin/AdminMarketsPage"));
const AdminAlertsPage = lazy(() => import("./pages/admin/AdminAlertsPage"));
const AdminIntegrationsPage = lazy(() => import("./pages/admin/AdminIntegrationsPage"));
const StallsPage = lazy(() => import("./pages/shared/StallsPage"));
const PaymentsPage = lazy(() => import("./pages/shared/PaymentsPage"));
const ComplaintsPage = lazy(() => import("./pages/shared/ComplaintsPage"));
const ReportsPage = lazy(() => import("./pages/shared/ReportsPage"));
const AuditPage = lazy(() => import("./pages/shared/AuditPage"));
const BillingPage = lazy(() => import("./pages/shared/BillingPage"));
const CoordinationPage = lazy(() => import("./pages/shared/CoordinationPage"));
const AnnouncementsPage = lazy(() => import("./pages/shared/AnnouncementsPage"));
const ProfileSettingsPage = lazy(() => import("./pages/shared/ProfileSettingsPage"));
const SettingsLayout = lazy(() => import("./pages/shared/SettingsLayout"));
const AccountSettingsPage = lazy(() => import("./pages/shared/settings/AccountSettingsPage"));
const SecuritySettingsPage = lazy(() => import("./pages/shared/settings/SecuritySettingsPage"));
const NotificationsSettingsPage = lazy(() => import("./pages/shared/settings/NotificationsSettingsPage"));
const PreferencesSettingsPage = lazy(() => import("./pages/shared/settings/PreferencesSettingsPage"));
const PaymentsSettingsPage = lazy(() => import("./pages/shared/settings/PaymentsSettingsPage"));
const DataSettingsPage = lazy(() => import("./pages/shared/settings/DataSettingsPage"));
const ActivitySettingsPage = lazy(() => import("./pages/shared/settings/ActivitySettingsPage"));
const AdminGeneralSettingsPage = lazy(() => import("./pages/shared/settings/AdminGeneralSettingsPage"));
const AdminSystemSettingsPage = lazy(() => import("./pages/shared/settings/AdminSystemSettingsPage"));
const IntegrationsSettingsPage = lazy(() => import("./pages/shared/settings/IntegrationsSettingsPage"));
const FeatureManagementSettingsPage = lazy(() => import("./pages/shared/settings/FeatureManagementSettingsPage"));
const EmailSettingsPage = lazy(() => import("./pages/shared/settings/EmailSettingsPage"));
const SmsSettingsPage = lazy(() => import("./pages/shared/settings/SmsSettingsPage"));
const LoggingSettingsPage = lazy(() => import("./pages/shared/settings/LoggingSettingsPage"));
const ManagerOperationsSettingsPage = lazy(() => import("./pages/shared/settings/ManagerOperationsSettingsPage"));
const ComplianceOversightSettingsPage = lazy(() => import("./pages/shared/settings/ComplianceOversightSettingsPage"));
const VendorsPage = lazy(() => import("./pages/manager/VendorsPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

/** React Query client with default stale time and retry settings. */
const queryClient = new QueryClient({
 defaultOptions: {
 queries: {
 staleTime: 30_000,
 refetchOnWindowFocus: false,
 retry: 1,
 },
 },
});

/**
 * Skeleton loading placeholder shown while lazy-loaded route chunks resolve.
 * Mirrors the dashboard layout structure to reduce layout shift on navigation.
 */
const RouteFallback = () => (
 <div className="min-h-screen bg-[#F8FAFC] p-6 text-sm text-muted-foreground">
 <div className="mx-auto flex w-full max-w-[1360px] gap-6">
 <div className="hidden h-[calc(100vh-48px)] w-[248px] rounded-lg border border-slate-200 bg-white md:block" />
 <div className="min-w-0 flex-1 space-y-6">
 <div className="h-16 rounded-lg border border-slate-200 bg-white" />
 <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
 {Array.from({ length: 4 }).map((_, index) => (
 <div key={index} className="h-24 rounded-lg border border-slate-200 bg-white" />
 ))}
 </div>
 <div className="h-72 rounded-lg border border-slate-200 bg-white" />
 </div>
 </div>
 </div>
);

/**
 * Conditionally renders Vercel Speed Insights only in production
 * and when not on localhost or 127.0.0.1 to avoid polluting dev metrics.
 */
const shouldRenderSpeedInsights = () => {
 if (!import.meta.env.PROD || typeof window === "undefined") return false;
 return !["localhost", "127.0.0.1"].includes(window.location.hostname);
};

/**
 * Shared settings route tree used across all role layouts.
 * Includes account, security, notifications, and role-gated admin pages.
 */
const sharedSettingsRoutes = (basePath: string) => (
  <>
    <Route path="notifications" element={<Navigate to={`${basePath}/settings/notifications`} replace />} />
    <Route path="settings" element={<SettingsLayout />}>
      <Route path="account" element={<AccountSettingsPage />} />
      <Route path="security" element={<SecuritySettingsPage />} />
      <Route path="notifications" element={<NotificationsSettingsPage />} />
      <Route path="preferences" element={<PreferencesSettingsPage />} />
      <Route path="payments" element={<PaymentsSettingsPage />} />
      <Route path="data" element={<DataSettingsPage />} />
      <Route path="activity" element={<ActivitySettingsPage />} />
      <Route path="general" element={<RoleRoute allowedRoles={["admin"]}><AdminGeneralSettingsPage /></RoleRoute>} />
      <Route path="system" element={<RoleRoute allowedRoles={["admin"]}><AdminSystemSettingsPage /></RoleRoute>} />
      <Route path="integrations" element={<RoleRoute allowedRoles={["admin"]}><IntegrationsSettingsPage /></RoleRoute>} />
      <Route path="features" element={<RoleRoute allowedRoles={["admin"]}><FeatureManagementSettingsPage /></RoleRoute>} />
      <Route path="email" element={<RoleRoute allowedRoles={["admin"]}><EmailSettingsPage /></RoleRoute>} />
      <Route path="sms" element={<RoleRoute allowedRoles={["admin"]}><SmsSettingsPage /></RoleRoute>} />
      <Route path="logging" element={<RoleRoute allowedRoles={["admin"]}><LoggingSettingsPage /></RoleRoute>} />
      <Route path="market-operations" element={<RoleRoute allowedRoles={["manager"]}><ManagerOperationsSettingsPage /></RoleRoute>} />
      <Route path="oversight" element={<RoleRoute allowedRoles={["official"]}><ComplianceOversightSettingsPage /></RoleRoute>} />
    </Route>
    <Route path="profile" element={<ProfileSettingsPage />} />
  </>
);

/**
 * Shared child route tree (billing, reports, audit, etc.) appended
 * to manager, official, and admin layouts.
 */
const sharedChildRoutes = (basePath: string) => (
  <>
    <Route path="billing" element={<BillingPage />} />
    <Route path="reports" element={<ReportsPage />} />
    <Route path="audit" element={<AuditPage />} />
    <Route path="coordination" element={<CoordinationPage />} />
    <Route path="announcements" element={<AnnouncementsPage />} />
    {sharedSettingsRoutes(basePath)}
  </>
);

/**
 * Vendor-specific child route tree with VendorApprovalGuard wrapping
 * sensitive pages for accounts whose approval is still pending.
 */
const vendorChildRoutes = (basePath: string) => (
  <>
    <Route path="billing" element={<VendorApprovalGuard><BillingPage /></VendorApprovalGuard>} />
    <Route path="reports" element={<VendorApprovalGuard><ReportsPage /></VendorApprovalGuard>} />
    <Route path="audit" element={<VendorApprovalGuard><AuditPage /></VendorApprovalGuard>} />
    <Route path="coordination" element={<VendorApprovalGuard><CoordinationPage /></VendorApprovalGuard>} />
    <Route path="announcements" element={<VendorApprovalGuard><AnnouncementsPage /></VendorApprovalGuard>} />
    {sharedSettingsRoutes(basePath)}
  </>
);

/**
 * Root application component.
 * Wraps the app in QueryClientProvider, TooltipProvider, AuthProvider,
 * and BrowserRouter with Suspense-based lazy loading for all routes.
 */
const App = () => (
 <QueryClientProvider client={queryClient}>
 <TooltipProvider>
  <Sonner />
 {shouldRenderSpeedInsights() ? <SpeedInsights /> : null}
  <AuthProvider>
   <HelmetProvider>
   <BrowserRouter>
    <RouteErrorBoundary>
  <Suspense fallback={<RouteFallback />}>
   <Routes>
 <Route path="/" element={<Index />} />
  <Route path="/login" element={<LoginPage />} />
  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
  <Route path="/register" element={<RegisterPage />} />
 <Route path="/payments/callback" element={<PaymentCallbackPage />} />

 {/* Vendor routes */}
 <Route
 path="/vendor"
 element={
 <ProtectedRoute allowedRoles={["vendor"]}>
 <AppLayout />
 </ProtectedRoute>
 }
 >
 <Route index element={<VendorDashboard />} />
 <Route path="stalls" element={<VendorApprovalGuard><StallsPage /></VendorApprovalGuard>} />
 <Route path="payments" element={<VendorApprovalGuard><PaymentsPage /></VendorApprovalGuard>} />
  <Route path="complaints" element={<VendorApprovalGuard><ComplaintsPage /></VendorApprovalGuard>} />
   {vendorChildRoutes("/vendor")}
 </Route>

 {/* Manager routes */}
 <Route
 path="/manager"
 element={
 <ProtectedRoute allowedRoles={["manager"]}>
 <AppLayout />
 </ProtectedRoute>
 }
 >
 <Route index element={<ManagerDashboard />} />
 <Route path="vendors" element={<VendorsPage />} />
 <Route path="stalls" element={<StallsPage />} />
 <Route path="payments" element={<PaymentsPage />} />
 <Route path="complaints" element={<ComplaintsPage />} />
  {sharedChildRoutes("/manager")}
 </Route>

 {/* Official routes */}
 <Route
 path="/official"
 element={
 <ProtectedRoute allowedRoles={["official"]}>
 <AppLayout />
 </ProtectedRoute>
 }
 >
 <Route index element={<OfficialDashboard />} />
 <Route path="markets" element={<OfficialMarketsPage />} />
 <Route path="vendors" element={<OfficialVendorDirectoryPage />} />
 <Route path="compliance" element={<OfficialCompliancePage />} />
 <Route path="analytics" element={<OfficialAnalyticsPage />} />
  {sharedChildRoutes("/official")}
 </Route>

 <Route
 path="/admin"
 element={
 <ProtectedRoute allowedRoles={["admin"]}>
 <AppLayout />
 </ProtectedRoute>
 }
 >
  <Route element={<AdminLayout />}>
    <Route index element={<AdminDashboard />} />
    <Route path="users" element={<UserManagementPage />} />
    <Route path="markets" element={<AdminMarketsPage />} />
    <Route path="alerts" element={<AdminAlertsPage />} />
    <Route path="integrations" element={<AdminIntegrationsPage />} />
  </Route>
   {sharedChildRoutes("/admin")}
  </Route>

  <Route path="*" element={<NotFound />} />
  </Routes>
  </Suspense>
    </RouteErrorBoundary>
   </BrowserRouter>
   </HelmetProvider>
 </AuthProvider>
 </TooltipProvider>
 </QueryClientProvider>
);

export default App;
