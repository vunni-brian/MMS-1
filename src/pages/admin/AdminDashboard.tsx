import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, BarChart3, CreditCard, MessagesSquare, ScrollText, ShieldCheck, SlidersHorizontal, Store, Users } from "lucide-react";
import { Link } from "react-router-dom";

import { api, ApiError } from "@/lib/api";
import { formatHumanDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ChargeType, ChargeTypeName } from "@/types";

const chargeDisplayOrder: ChargeTypeName[] = ["market_dues", "utilities", "penalties", "booking_fee", "payment_gateway"];

const chargeDescriptions: Record<ChargeTypeName, string> = {
  market_dues: "Core market collection controlled centrally by admin.",
  utilities: "Shared service charges exposed only when approved at system level.",
  penalties: "Compliance and enforcement charges managed from the governance layer.",
  booking_fee: "Booking activation charges enabled only through admin billing policy.",
  payment_gateway: "Platform payment infrastructure switch for secure collections.",
};

const quickActions = [
  { label: "Manage Billing", path: "/admin/billing", icon: SlidersHorizontal },
  { label: "View Audit Trail", path: "/admin/audit", icon: ScrollText },
  { label: "View Reports", path: "/admin/reports", icon: BarChart3 },
  { label: "Open Coordination", path: "/admin/coordination", icon: MessagesSquare },
];

const statusPillClass = (isEnabled: boolean) =>
  isEnabled
    ? "bg-success/10 text-success border-success/20"
    : "bg-destructive/10 text-destructive border-destructive/20";

const AdminDashboard = () => {
  const queryClient = useQueryClient();
  const [managerError, setManagerError] = useState<string | null>(null);
  const [managerMessage, setManagerMessage] = useState<string | null>(null);
  const [managerForm, setManagerForm] = useState({
    name: "",
    email: "",
    phone: "",
    marketId: "",
  });
  const { data: marketsData } = useQuery({
    queryKey: ["markets", "admin-dashboard"],
    queryFn: () => api.getMarkets(),
  });
  const { data: vendorsData } = useQuery({
    queryKey: ["vendors", "admin-dashboard"],
    queryFn: () => api.getVendors(),
  });
  const { data: paymentsData } = useQuery({
    queryKey: ["payments", "admin-dashboard"],
    queryFn: () => api.getPayments(),
  });
  const { data: ticketsData } = useQuery({
    queryKey: ["tickets", "admin-dashboard"],
    queryFn: () => api.getTickets(),
  });
  const { data: resourceRequestsData } = useQuery({
    queryKey: ["resource-requests", "admin-dashboard"],
    queryFn: () => api.getResourceRequests(),
  });
  const { data: financialAuditData } = useQuery({
    queryKey: ["financial-audit", "admin-dashboard"],
    queryFn: () => api.getFinancialAudit(),
  });
  const { data: chargeTypesData } = useQuery({
    queryKey: ["charge-types", "admin-dashboard"],
    queryFn: () => api.getChargeTypes(),
  });

  const assignManager = useMutation({
    mutationFn: () => api.createManager(managerForm),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["markets"] });
      setManagerMessage(response.message);
      setManagerError(null);
      setManagerForm((current) => ({
        ...current,
        name: "",
        email: "",
        phone: "",
      }));
    },
    onError: (error) => {
      setManagerMessage(null);
      setManagerError(error instanceof ApiError ? error.message : "Unable to assign manager.");
    },
  });

  const markets = marketsData?.markets || [];
  const vendors = vendorsData?.vendors || [];
  const payments = paymentsData?.payments || [];
  const tickets = ticketsData?.tickets || [];
  const resourceRequests = resourceRequestsData?.requests || [];
  const chargeTypes = chargeTypesData?.chargeTypes || [];
  const auditSummary = financialAuditData?.summary || { variance: 0, collectedTotal: 0, depositedTotal: 0, from: "", to: "" };

  const unresolvedGovernanceTickets = tickets.filter(
    (ticket) => ticket.status !== "resolved" && (ticket.category === "billing" || ticket.category === "dispute"),
  ).length;
  const pendingGovernanceRequests = resourceRequests.filter((request) => request.status === "pending").length;
  const openGovernanceItems = unresolvedGovernanceTickets + pendingGovernanceRequests + (auditSummary.variance !== 0 ? 1 : 0);

  const billingSummary = chargeDisplayOrder
    .map((name) => chargeTypes.find((chargeType) => chargeType.name === name))
    .filter(Boolean) as ChargeType[];
  const managerAssignments = markets.map((market) => ({
    id: market.id,
    name: market.name,
    location: market.location,
    managerName: market.managerName,
  }));

  useEffect(() => {
    if (!managerForm.marketId && markets.length > 0) {
      setManagerForm((current) => ({
        ...current,
        marketId: markets[0].id,
      }));
    }
  }, [managerForm.marketId, markets]);

  const stats = [
    {
      label: "Total Markets",
      value: markets.length,
      detail: "Cross-market platform footprint",
      icon: Store,
      accent: "text-muted-foreground",
    },
    {
      label: "Total Vendors",
      value: vendors.length,
      detail: "Registered service consumers",
      icon: Users,
      accent: "text-muted-foreground",
    },
    {
      label: "Payments Monitored",
      value: payments.length,
      detail: "Transactions under platform oversight",
      icon: CreditCard,
      accent: "text-muted-foreground",
    },
    {
      label: "Open Governance Items",
      value: openGovernanceItems,
      detail: "Audit, dispute, and approval signals",
      icon: AlertTriangle,
      accent: "text-muted-foreground",
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="card-warm">
        <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              Top-Level Governance
            </div>
            <div>
              <h1 className="text-2xl font-bold font-heading">Admin Dashboard</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Centralized visibility into billing status, payment infrastructure, audit pressure points, and cross-market control signals.
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-border/70 bg-muted/25 p-4 text-sm text-muted-foreground lg:max-w-sm">
            Only the Admin role may directly activate or deactivate charge categories and payment infrastructure.
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold font-heading">System Overview</h2>
          <p className="text-sm text-muted-foreground">High-level counts for platform activity and governance workload.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="card-warm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="mt-1 text-2xl font-bold font-heading">{stat.value.toLocaleString()}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{stat.detail}</p>
                  </div>
                  <stat.icon className={`h-5 w-5 ${stat.accent}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold font-heading">Billing Control Summary</h2>
            <p className="text-sm text-muted-foreground">Central switch status for every governed charge category.</p>
          </div>
          <Button asChild variant="outline">
            <Link to="/admin/billing">Open Billing Controls</Link>
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {billingSummary.map((chargeType) => (
            <Card key={chargeType.id} className="card-warm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between gap-3 text-base font-heading">
                  <span>{chargeType.displayName}</span>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusPillClass(chargeType.isEnabled)}`}>
                    {chargeType.isEnabled ? "Enabled" : "Disabled"}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">{chargeDescriptions[chargeType.name]}</p>
                <div className="rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground">
                  Last updated by {chargeType.updatedByName || "system"} on {formatHumanDateTime(chargeType.updatedAt)}.
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold font-heading">Administrative Ownership</h2>
          <p className="text-sm text-muted-foreground">Admin-only operational ownership that should not appear in official oversight workspaces.</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <Card className="card-warm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading">Manager Provisioning</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Create or replace a market manager account from the admin workspace. This action remains outside the official role because it changes operational ownership.
              </p>
              {managerMessage && <div className="rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">{managerMessage}</div>}
              {managerError && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{managerError}</div>}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="admin-manager-name">Manager Name</Label>
                  <Input
                    id="admin-manager-name"
                    value={managerForm.name}
                    onChange={(event) => setManagerForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Full name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="admin-manager-phone">Phone Number</Label>
                  <Input
                    id="admin-manager-phone"
                    value={managerForm.phone}
                    onChange={(event) => setManagerForm((current) => ({ ...current, phone: event.target.value }))}
                    placeholder="+256 7XX XXX XXX"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="admin-manager-email">Email Address</Label>
                  <Input
                    id="admin-manager-email"
                    type="email"
                    value={managerForm.email}
                    onChange={(event) => setManagerForm((current) => ({ ...current, email: event.target.value }))}
                    placeholder="manager@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="admin-manager-market">Assigned Market</Label>
                  <Select value={managerForm.marketId} onValueChange={(value) => setManagerForm((current) => ({ ...current, marketId: value }))}>
                    <SelectTrigger id="admin-manager-market">
                      <SelectValue placeholder="Select market" />
                    </SelectTrigger>
                    <SelectContent>
                      {markets.map((market) => (
                        <SelectItem key={market.id} value={market.id}>
                          {market.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                onClick={() => assignManager.mutate()}
                disabled={
                  assignManager.isPending ||
                  !managerForm.name.trim() ||
                  !managerForm.email.trim() ||
                  !managerForm.phone.trim() ||
                  !managerForm.marketId
                }
              >
                {assignManager.isPending ? "Saving Manager..." : "Assign Manager"}
              </Button>
            </CardContent>
          </Card>

          <Card className="card-warm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading">Current Market Managers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {managerAssignments.map((market) => (
                <div key={market.id} className="rounded-xl border bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm">{market.name}</p>
                      <p className="text-xs text-muted-foreground">{market.location}</p>
                    </div>
                    <p className="text-sm font-medium">{market.managerName || "Unassigned"}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold font-heading">Quick Actions</h2>
            <p className="text-sm text-muted-foreground">Jump directly into the main governance control points.</p>
          </div>
          <Card className="card-warm">
            <CardContent className="grid gap-3 p-4">
              {quickActions.map((action) => (
                <Button key={action.path} asChild variant="outline" className="justify-between">
                  <Link to={action.path}>
                    <span className="flex items-center gap-2">
                      <action.icon className="h-4 w-4" />
                      {action.label}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold font-heading">Governance Note</h2>
            <p className="text-sm text-muted-foreground">Role boundaries for centralized financial and compliance control.</p>
          </div>
          <Card className="card-warm">
            <CardContent className="space-y-4 p-5 text-sm text-muted-foreground">
              <div className="rounded-lg border border-border/70 bg-muted/25 p-4 text-foreground">
                The Admin Dashboard is the top-level governance page of the system. It centralizes billing status, system activity, and regulatory control points across all markets.
              </div>
              <div className="space-y-3">
                <div className="rounded-xl bg-muted/25 p-4">
                  <p className="font-medium text-foreground">Vendor</p>
                  <p className="mt-1">Consumes active services, charges, receipts, and notifications without modifying billing settings.</p>
                </div>
                <div className="rounded-xl bg-muted/25 p-4">
                  <p className="font-medium text-foreground">Manager</p>
                  <p className="mt-1">Operates the market within approved controls and does not directly change billing switches.</p>
                </div>
                <div className="rounded-xl bg-muted/25 p-4">
                  <p className="font-medium text-foreground">Official</p>
                  <p className="mt-1">Oversees billing state, reports, and audits, but does not directly toggle charge controls in the current implementation.</p>
                </div>
                <div className="rounded-xl bg-muted/25 p-4">
                  <p className="font-medium text-foreground">Admin</p>
                  <p className="mt-1">Centrally governs charge activation, payment infrastructure, audit visibility, and cross-market control points.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
};

export default AdminDashboard;
