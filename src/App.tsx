import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
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
const UserManagementPage = lazy(() => import("./pages/admin/UserManagementPage"));
const SystemSettingsPage = lazy(() => import("./pages/admin/SystemSettingsPage"));
const StallsPage = lazy(() => import("./pages/shared/StallsPage"));
const PaymentsPage = lazy(() => import("./pages/shared/PaymentsPage"));
const ComplaintsPage = lazy(() => import("./pages/shared/ComplaintsPage"));
const ReportsPage = lazy(() => import("./pages/shared/ReportsPage"));
const AuditPage = lazy(() => import("./pages/shared/AuditPage"));
const BillingPage = lazy(() => import("./pages/shared/BillingPage"));
const CoordinationPage = lazy(() => import("./pages/shared/CoordinationPage"));
const AnnouncementsPage = lazy(() => import("./pages/shared/AnnouncementsPage"));
const ProfileSettingsPage = lazy(() => import("./pages/shared/ProfileSettingsPage"));
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
  <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
    Loading workspace...
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
              <Route path="users" element={<UserManagementPage />} />
              <Route path="settings" element={<SystemSettingsPage />} />
              <Route path="billing" element={<BillingPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="audit" element={<AuditPage />} />
              <Route path="coordination" element={<CoordinationPage />} />
              <Route path="announcements" element={<AnnouncementsPage />} />
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
