import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute, VendorApprovalGuard } from "@/components/ProtectedRoute";
import { SpeedInsights } from "@vercel/speed-insights/react";

const Index = lazy(() => import("./pages/Index"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const PaymentCallbackPage = lazy(() => import("./pages/PaymentCallbackPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const AppLayout = lazy(() => import("./components/AppLayout"));
const VendorDashboard = lazy(() => import("./pages/vendor/VendorDashboard"));
const ManagerDashboard = lazy(() => import("./pages/manager/ManagerDashboard"));
const OfficialDashboard = lazy(() => import("./pages/official/OfficialDashboard"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsersPage = lazy(() => import("./pages/admin/UserManagementPage"));
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
const SettingsPage = lazy(() => import("./pages/shared/SettingsPage"));
const VendorsPage = lazy(() => import("./pages/manager/VendorsPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
 defaultOptions: {
 queries: {
 staleTime: 30_000,
 refetchOnWindowFocus: false,
 retry: 1,
 },
 },
});

const RouteFallback = () => (
 <div className="min-h-screen bg-[#F8FAFC] p-6 text-sm text-muted-foreground">
 <div className="mx-auto flex w-full max-w-[1360px] gap-6">
 <div className="hidden h-[calc(100vh-48px)] w-[248px] rounded-sm border border-slate-200 bg-white md:block" />
 <div className="min-w-0 flex-1 space-y-6">
 <div className="h-16 rounded-sm border border-slate-200 bg-white" />
 <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
 {Array.from({ length: 4 }).map((_, index) => (
 <div key={index} className="h-24 rounded-sm border border-slate-200 bg-white" />
 ))}
 </div>
 <div className="h-72 rounded-sm border border-slate-200 bg-white" />
 </div>
 </div>
 </div>
);

const shouldRenderSpeedInsights = () => {
 if (!import.meta.env.PROD || typeof window === "undefined") return false;
 return !["localhost", "127.0.0.1"].includes(window.location.hostname);
};

const App = () => (
 <QueryClientProvider client={queryClient}>
 <TooltipProvider>
 <Toaster />
 <Sonner />
 {shouldRenderSpeedInsights() ? <SpeedInsights /> : null}
 <AuthProvider>
 <BrowserRouter>
 <Suspense fallback={<RouteFallback />}>
 <Routes>
 <Route path="/" element={<Index />} />
 <Route path="/login" element={<LoginPage />} />
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
 <Route path="announcements" element={<AnnouncementsPage />} />
 <Route path="notifications" element={<Navigate to="/vendor/settings?section=notifications" replace />} />
 <Route path="settings" element={<SettingsPage />} />
 <Route path="profile" element={<ProfileSettingsPage />} />
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
 <Route path="billing" element={<BillingPage />} />
 <Route path="reports" element={<ReportsPage />} />
 <Route path="audit" element={<AuditPage />} />
 <Route path="coordination" element={<CoordinationPage />} />
 <Route path="announcements" element={<AnnouncementsPage />} />
 <Route path="notifications" element={<Navigate to="/manager/settings?section=notifications" replace />} />
 <Route path="settings" element={<SettingsPage />} />
 <Route path="profile" element={<ProfileSettingsPage />} />
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
 <Route path="billing" element={<BillingPage />} />
 <Route path="reports" element={<ReportsPage />} />
 <Route path="audit" element={<AuditPage />} />
 <Route path="coordination" element={<CoordinationPage />} />
 <Route path="announcements" element={<AnnouncementsPage />} />
 <Route path="notifications" element={<Navigate to="/official/settings?section=notifications" replace />} />
 <Route path="settings" element={<SettingsPage />} />
 <Route path="profile" element={<ProfileSettingsPage />} />
 </Route>

 <Route
 path="/admin"
 element={
 <ProtectedRoute allowedRoles={["admin"]}>
 <AppLayout />
 </ProtectedRoute>
 }
 >
 <Route index element={<AdminDashboard />} />
 <Route path="users" element={<AdminUsersPage />} />
 <Route path="markets" element={<AdminMarketsPage />} />
 <Route path="alerts" element={<AdminAlertsPage />} />
 <Route path="integrations" element={<AdminIntegrationsPage />} />
 <Route path="settings" element={<SettingsPage />} />
 <Route path="billing" element={<BillingPage />} />
 <Route path="reports" element={<ReportsPage />} />
 <Route path="audit" element={<AuditPage />} />
 <Route path="coordination" element={<CoordinationPage />} />
 <Route path="announcements" element={<AnnouncementsPage />} />
 <Route path="notifications" element={<Navigate to="/admin/settings?section=notifications" replace />} />
 <Route path="profile" element={<ProfileSettingsPage />} />
 </Route>

 <Route path="*" element={<NotFound />} />
 </Routes>
 </Suspense>
 </BrowserRouter>
 </AuthProvider>
 </TooltipProvider>
 </QueryClientProvider>
);

export default App;
