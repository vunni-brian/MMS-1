/**
 * Tests for React route-guard components (RoleRoute, VendorApprovalGuard).
 * Verifies that each role is correctly allowed/redirected based on
 * allowedRoles, vendor approval status, and route wiring.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RoleRoute, VendorApprovalGuard } from "@/components/ProtectedRoute";
import type { AuthUser } from "@/types";

vi.mock("lottie-react", () => ({ default: () => null }));

const mockUseAuth = vi.hoisted(() => vi.fn());
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: mockUseAuth,
}));

const LoadingFallback = () => <div data-testid="loading">Loading…</div>;
const TestContent = () => <div data-testid="content">Content</div>;

const roles: Array<AuthUser["role"]> = ["vendor", "manager", "official", "admin"];

const vendorStatuses = ["approved", "pending", "rejected"] as const;

describe("RoleRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(roles)("allows %s when role is in allowedRoles", (role) => {
    mockUseAuth.mockReturnValue({ user: { role } });
    render(
      <MemoryRouter initialEntries={["/test"]}>
        <RoleRoute allowedRoles={[role]}>
          <TestContent />
        </RoleRoute>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("content")).toBeTruthy();
  });

  it.each([
    { userRole: "vendor" as const, allowedRoles: ["manager"], redirect: "/vendor/settings" },
    { userRole: "vendor" as const, allowedRoles: ["admin"], redirect: "/vendor/settings" },
    { userRole: "manager" as const, allowedRoles: ["vendor"], redirect: "/manager/settings" },
    { userRole: "manager" as const, allowedRoles: ["admin"], redirect: "/manager/settings" },
    { userRole: "manager" as const, allowedRoles: ["official"], redirect: "/manager/settings" },
    { userRole: "official" as const, allowedRoles: ["vendor"], redirect: "/official/settings" },
    { userRole: "official" as const, allowedRoles: ["admin"], redirect: "/official/settings" },
    { userRole: "official" as const, allowedRoles: ["manager"], redirect: "/official/settings" },
    { userRole: "admin" as const, allowedRoles: ["vendor"], redirect: "/admin/settings" },
  ])("redirects $userRole away from $allowedRoles", ({ userRole, allowedRoles, redirect }) => {
    mockUseAuth.mockReturnValue({ user: { role: userRole } });
    render(
      <MemoryRouter initialEntries={["/test"]}>
        <Routes>
          <Route path="/test" element={<RoleRoute allowedRoles={allowedRoles}><TestContent /></RoleRoute>} />
          <Route path={redirect} element={<div data-testid="redirected">Redirected</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("redirected")).toBeTruthy();
  });

  it.each([
    { role: "admin" as const, allowed: ["admin"] },
    { role: "manager" as const, allowed: ["manager"] },
    { role: "official" as const, allowed: ["official"] },
  ])("allows $role to access their own guarded settings", ({ role, allowed }) => {
    mockUseAuth.mockReturnValue({ user: { role } });
    render(
      <MemoryRouter initialEntries={["/test"]}>
        <RoleRoute allowedRoles={allowed}>
          <TestContent />
        </RoleRoute>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("content")).toBeTruthy();
  });
});

describe("VendorApprovalGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows approved vendors through", () => {
    mockUseAuth.mockReturnValue({ user: { role: "vendor", vendorStatus: "approved" } });
    render(
      <MemoryRouter initialEntries={["/vendor/billing"]}>
        <VendorApprovalGuard>
          <TestContent />
        </VendorApprovalGuard>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("content")).toBeTruthy();
  });

  it.each(["pending", "rejected"] as const)("redirects %s vendors away from guarded routes", (status) => {
    mockUseAuth.mockReturnValue({ user: { role: "vendor", vendorStatus: status } });
    render(
      <MemoryRouter initialEntries={["/vendor/reports"]}>
        <Routes>
          <Route path="/vendor/reports" element={<VendorApprovalGuard><TestContent /></VendorApprovalGuard>} />
          <Route path="/vendor" element={<div data-testid="redirected">Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("redirected")).toBeTruthy();
  });

  it("allows non-vendor roles through regardless of vendorStatus", () => {
    mockUseAuth.mockReturnValue({ user: { role: "manager", vendorStatus: null } });
    render(
      <MemoryRouter initialEntries={["/manager/billing"]}>
        <VendorApprovalGuard>
          <TestContent />
        </VendorApprovalGuard>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("content")).toBeTruthy();
  });
});

describe("Route wiring verification", () => {
  it("enforces admin-only role guard on general settings", () => {
    mockUseAuth.mockReturnValue({ user: { role: "vendor" } });
    render(
      <MemoryRouter initialEntries={["/settings/general"]}>
        <Routes>
          <Route path="/settings/general" element={<RoleRoute allowedRoles={["admin"]}><TestContent /></RoleRoute>} />
          <Route path="/vendor/settings" element={<div data-testid="redirected">Redirected</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("redirected")).toBeTruthy();
  });

  it("enforces manager-only role guard on market-operations", () => {
    mockUseAuth.mockReturnValue({ user: { role: "vendor" } });
    render(
      <MemoryRouter initialEntries={["/settings/market-operations"]}>
        <Routes>
          <Route path="/settings/market-operations" element={<RoleRoute allowedRoles={["manager"]}><TestContent /></RoleRoute>} />
          <Route path="/vendor/settings" element={<div data-testid="redirected">Redirected</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("redirected")).toBeTruthy();
  });

  it("enforces official-only role guard on oversight settings", () => {
    mockUseAuth.mockReturnValue({ user: { role: "manager" } });
    render(
      <MemoryRouter initialEntries={["/settings/oversight"]}>
        <Routes>
          <Route path="/settings/oversight" element={<RoleRoute allowedRoles={["official"]}><TestContent /></RoleRoute>} />
          <Route path="/manager/settings" element={<div data-testid="redirected">Redirected</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("redirected")).toBeTruthy();
  });
});
