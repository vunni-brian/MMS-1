import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Database,
  KeyRound,
  Link2,
  Mail,
  MessageSquare,
  Plug,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { DASHBOARD_CONFIG } from "@/config/dashboard";
import { api } from "@/lib/api";
import { cn, formatHumanDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ConsolePage,
  EmptyState,
  LoadingState,
  WorkspacePage,
} from "@/components/console/ConsolePage";

type IntegrationCategory = "all" | "payments" | "messaging" | "data" | "security";
type IntegrationStatus = "connected" | "attention" | "configured" | "inactive";

interface IntegrationCard {
  name: string;
  category: Exclude<IntegrationCategory, "all">;
  description: string;
  status: IntegrationStatus;
  detail: string;
  icon: typeof Plug;
}

const statusClassName = (status: IntegrationStatus) => {
  if (status === "connected") return "status-badge border-success/20 bg-success/15 text-success";
  if (status === "attention") return "status-badge border-warning/25 bg-warning/15 text-warning";
  if (status === "configured") return "status-badge border-info/20 bg-info/15 text-info";
  return "status-badge border-border bg-muted text-muted-foreground";
};

const statusLabel: Record<IntegrationStatus, string> = {
  connected: "Connected",
  attention: "Needs Review",
  configured: "Configured",
  inactive: "Inactive",
};

const categoryLabels: Record<Exclude<IntegrationCategory, "all">, string> = {
  payments: "Payments",
  messaging: "Messaging",
  data: "Data and reporting",
  security: "Access and security",
};

const AdminIntegrationsPage = () => {
  const navigate = useNavigate();
  const [category, setCategory] = useState<IntegrationCategory>("all");

  // Where each integration's Manage button should navigate
  const integrationPaths: Record<string, string> = {
    "Payment Gateway": "/admin/billing",
    "SMS Notifications": "/admin/settings",
    "Email Delivery": "/admin/settings",
    "Database Backup": "/admin/audit",
    "Reports Export": "/admin/reports",
    "Access Control": "/admin/users",
  };

  const chargeTypesQuery = useQuery({
    queryKey: ["charge-types", "admin-integrations-page"],
    queryFn: () => api.getChargeTypes(),
    gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME,
  });

  const auditQuery = useQuery({
    queryKey: ["audit", "admin-integrations-page"],
    queryFn: () => api.getAudit(),
    gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME,
  });

  const chargeTypes = chargeTypesQuery.data?.chargeTypes || [];
  const auditEvents = auditQuery.data?.events || [];
  const paymentGateway = chargeTypes.find((chargeType) => chargeType.name === "payment_gateway");
  const isLoading = chargeTypesQuery.isPending || auditQuery.isPending;

  const integrations = useMemo<IntegrationCard[]>(() => {
    const paymentEnabled = paymentGateway?.isEnabled !== false;

    return [
      {
        name: "Payment Gateway",
        category: "payments",
        description: "Online payment initiation, receipt verification, and callback handling.",
        status: paymentEnabled ? "connected" : "attention",
        detail: paymentEnabled ? "Collections available" : "Collections paused",
        icon: CheckCircle2,
      },
      {
        name: "SMS Notifications",
        category: "messaging",
        description: "Vendor and staff delivery for important notices and payment updates.",
        status: "configured",
        detail: "System channel active",
        icon: MessageSquare,
      },
      {
        name: "Email Delivery",
        category: "messaging",
        description: "Staff invitations, report delivery, and account notifications.",
        status: "configured",
        detail: "Transactional mail ready",
        icon: Mail,
      },
      {
        name: "Database Backup",
        category: "data",
        description: "Operational records, audit history, and reporting snapshots.",
        status: "connected",
        detail: "Last backup healthy",
        icon: Database,
      },
      {
        name: "Reports Export",
        category: "data",
        description: "CSV exports for finance, activity records, users, and market reviews.",
        status: "configured",
        detail: "Exports enabled",
        icon: Link2,
      },
      {
        name: "Access Control",
        category: "security",
        description: "Role permissions, protected routes, and staff session controls.",
        status: "connected",
        detail: "Role checks active",
        icon: ShieldCheck,
      },
    ];
  }, [paymentGateway?.isEnabled]);

  const filteredIntegrations = integrations.filter((integration) => category === "all" || integration.category === category);
  const groupedIntegrations = filteredIntegrations.reduce<Record<Exclude<IntegrationCategory, "all">, IntegrationCard[]>>(
    (groups, integration) => {
      groups[integration.category].push(integration);
      return groups;
    },
    {
      payments: [],
      messaging: [],
      data: [],
      security: [],
    },
  );
  const openIssues = integrations.filter((integration) => integration.status === "attention").length;
  const context = `${integrations.length} integrations - ${openIssues} need review`;

  const apiKeys = [
    { name: "Admin API", scope: "Users, markets, reports", status: "Active", lastUsed: "Current session" },
    { name: "Payment Callback", scope: "Payment status updates", status: paymentGateway?.isEnabled === false ? "Paused" : "Active", lastUsed: paymentGateway?.updatedAt || "Not available" },
    { name: "Report Export", scope: "CSV and audit exports", status: "Active", lastUsed: "On demand" },
  ];

  const activityRows = auditEvents
    .filter((event) => event.entityType.toLowerCase().includes("charge") || event.action.toLowerCase().includes("settings"))
    .slice(0, 6);

  return (
    <ConsolePage>
      <WorkspacePage
        title="Integrations"
        subtitle="Review platform connections without changing operational workflows."
        context={context}
        actions={
          <Button variant="outline" className="gap-2" onClick={() => navigate("/admin/settings")}>
            <RefreshCw className="h-4 w-4" />
            Check Status
          </Button>
        }
        filters={
          <div className="w-full sm:w-[220px]">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Category</label>
            <Select value={category} onValueChange={(value) => setCategory(value as IntegrationCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All integrations</SelectItem>
                <SelectItem value="payments">Payments</SelectItem>
                <SelectItem value="messaging">Messaging</SelectItem>
                <SelectItem value="data">Data</SelectItem>
                <SelectItem value="security">Security</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        {isLoading ? (
          <div className="p-4">
            <LoadingState rows={6} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" itemClassName="h-[160px] rounded-xl" />
          </div>
        ) : (
          <div className="admin-integrations-layout">
            <section className="admin-integration-groups">
              {filteredIntegrations.length === 0 ? (
                <EmptyState title="No integrations found" description="Choose another category to view available connections." />
              ) : (
                (Object.keys(groupedIntegrations) as Array<Exclude<IntegrationCategory, "all">>)
                  .filter((groupKey) => groupedIntegrations[groupKey].length > 0)
                  .map((groupKey) => (
                    <section key={groupKey} className="admin-integration-group">
                      <div className="admin-integration-group-header">
                        <div>
                          <h2 className="text-sm font-semibold font-heading">{categoryLabels[groupKey]}</h2>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {groupedIntegrations[groupKey].length} connection{groupedIntegrations[groupKey].length === 1 ? "" : "s"}
                          </p>
                        </div>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {groupedIntegrations[groupKey].filter((item) => item.status === "attention").length} review
                        </span>
                      </div>

                      <div>
                        {groupedIntegrations[groupKey].map((integration) => {
                          const Icon = integration.icon;

                          return (
                            <article key={integration.name} className="admin-integration-row">
                              <div className="flex min-w-0 items-start gap-3">
                                <span className="admin-integration-icon">
                                  <Icon className="h-4 w-4" />
                                </span>
                                <div className="min-w-0">
                                  <h3 className="text-sm font-semibold font-heading">{integration.name}</h3>
                                  <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">{integration.description}</p>
                                  <p className="mt-1 text-xs font-medium text-muted-foreground">{integration.detail}</p>
                                </div>
                              </div>
                              <span className={statusClassName(integration.status)}>{statusLabel[integration.status]}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="justify-self-start md:justify-self-end"
                                onClick={() => navigate(integrationPaths[integration.name] || "/admin/settings")}
                              >
                                Manage
                              </Button>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ))
              )}
            </section>

            <section className="admin-integration-panels">
              <div className="admin-quiet-panel">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold font-heading">Connection Controls</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">Visible status only. Actual provider changes remain controlled by settings.</p>
                  </div>
                  <Plug className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="mt-4 space-y-2">
                  {[
                    ["Payment callbacks", paymentGateway?.isEnabled !== false],
                    ["Report exports", true],
                    ["Staff notifications", true],
                  ].map(([label, checked]) => (
                    <div key={String(label)} className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-background px-3 py-2">
                      <span className="text-sm">{label}</span>
                      <Switch defaultChecked={Boolean(checked)} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="admin-quiet-panel overflow-hidden p-0">
                <div className="border-b border-border/70 px-4 py-3">
                  <p className="text-sm font-semibold font-heading">API Keys</p>
                  <p className="mt-1 text-xs text-muted-foreground">Access scopes and recent use.</p>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Used</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {apiKeys.map((key) => (
                        <TableRow key={key.name}>
                          <TableCell>
                            <div className="flex items-start gap-2">
                              <KeyRound className="mt-0.5 h-4 w-4 text-muted-foreground" />
                              <span>
                                <span className="block font-medium">{key.name}</span>
                                <span className="block text-xs text-muted-foreground">{key.scope}</span>
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                "status-badge",
                                key.status === "Active"
                                  ? "border-success/20 bg-success/15 text-success"
                                  : "border-warning/25 bg-warning/15 text-warning",
                              )}
                            >
                              {key.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {key.lastUsed === "Current session" || key.lastUsed === "On demand" || key.lastUsed === "Not available"
                              ? key.lastUsed
                              : formatHumanDateTime(key.lastUsed)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="admin-quiet-panel">
                <p className="text-sm font-semibold font-heading">Integration Activity</p>
                <div className="mt-3 space-y-2">
                  {activityRows.length === 0 ? (
                    <EmptyState title="No integration activity" description="Recent provider changes and settings updates will appear here." />
                  ) : (
                    activityRows.map((event) => (
                      <div key={event.id} className="rounded-md border border-border/70 bg-background px-3 py-2">
                        <p className="truncate text-sm font-medium">{event.action.replace(/_/g, " ")}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {event.actorName} - {formatHumanDateTime(event.createdAt)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
      </WorkspacePage>
    </ConsolePage>
  );
};

export default AdminIntegrationsPage;
