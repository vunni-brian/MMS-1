import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Index from "./pages/Index";
import LoginPage from "./pages/LoginPage";
import PaymentCallbackPage from "./pages/PaymentCallbackPage";
import RegisterPage from "./pages/RegisterPage";
import AppLayout from "./components/AppLayout";
import VendorDashboard from "./pages/vendor/VendorDashboard";
import ManagerDashboard from "./pages/manager/ManagerDashboard";
import OfficialDashboard from "./pages/official/OfficialDashboard";
import StallsPage from "./pages/shared/StallsPage";
import PaymentsPage from "./pages/shared/PaymentsPage";
import ComplaintsPage from "./pages/shared/ComplaintsPage";
import ReportsPage from "./pages/shared/ReportsPage";
import AuditPage from "./pages/shared/AuditPage";
import BillingPage from "./pages/shared/BillingPage";
import CoordinationPage from "./pages/shared/CoordinationPage";
import NotificationsPage from "./pages/vendor/NotificationsPage";
import ProfilePage from "./pages/vendor/ProfilePage";
import VendorsPage from "./pages/manager/VendorsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
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
              <Route path="stalls" element={<StallsPage />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="complaints" element={<ComplaintsPage />} />
              <Route path="profile" element={<ProfilePage />} />
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
            </Route>

            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<OfficialDashboard />} />
              <Route path="billing" element={<BillingPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="audit" element={<AuditPage />} />
              <Route path="coordination" element={<CoordinationPage />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
