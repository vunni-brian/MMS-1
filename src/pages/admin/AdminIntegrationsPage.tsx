import { useTranslation } from "react-i18next";
import { useMemo, useState, type ComponentType } from "react";
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
  Filter,
  AlertCircle,
} from "lucide-react";

import { DASHBOARD_CONFIG } from "@/config/dashboard";
import { api } from "@/lib/api";
import { formatHumanDateTime, tSnake } from "@/lib/utils";
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
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WorkspaceLayout } from "@/components/WorkspaceLayout";

type IntegrationCategory = "all" | "payments" | "messaging" | "data" | "security";
type IntegrationStatus = "connected" | "attention" | "configured" | "inactive";

interface IntegrationCard {
  name: string;
  category: Exclude<IntegrationCategory, "all">;
  description: string;
  status: IntegrationStatus;
  detail: string;
  icon: ComponentType<{ className?: string }>;
}

const statusConfig = {
  connected: { label: "admin:integrations.status.connected", className: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  attention: { label: "admin:integrations.status.attention", className: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: AlertCircle },
  configured: { label: "admin:integrations.status.configured", className: "bg-blue-100 text-blue-700 border-blue-200", icon: ShieldCheck },
  inactive: { label: "admin:integrations.status.inactive", className: "bg-slate-100 text-slate-600 border-slate-200", icon: Plug },
};

const categoryLabels: Record<Exclude<IntegrationCategory, "all">, string> = {
  payments: "admin:integrations.category.payments",
  messaging: "admin:integrations.category.messaging",
  data: "admin:integrations.category.data",
  security: "admin:integrations.category.security",
};

const AdminIntegrationsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [category, setCategory] = useState<IntegrationCategory>("all");

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
        description: t("admin:integrations.paymentGatewayDesc"),
        status: paymentEnabled ? "connected" : "attention",
        detail: paymentEnabled ? t("admin:integrations.collectionsAvailable") : t("admin:integrations.collectionsPaused"),
        icon: CheckCircle2,
      },
      {
        name: "SMS Notifications",
        category: "messaging",
        description: t("admin:integrations.smsNotificationsDesc"),
        status: "configured",
        detail: t("admin:integrations.systemChannelActive"),
        icon: MessageSquare,
      },
      {
        name: "Email Delivery",
        category: "messaging",
        description: t("admin:integrations.emailDeliveryDesc"),
        status: "configured",
        detail: t("admin:integrations.transactionalMailReady"),
        icon: Mail,
      },
      {
        name: "Database Backup",
        category: "data",
        description: t("admin:integrations.databaseBackupDesc"),
        status: "connected",
        detail: t("admin:integrations.lastBackupHealthy"),
        icon: Database,
      },
      {
        name: "Reports Export",
        category: "data",
        description: t("admin:integrations.reportsExportDesc"),
        status: "configured",
        detail: t("admin:integrations.exportsEnabled"),
        icon: Link2,
      },
      {
        name: "Access Control",
        category: "security",
        description: t("admin:integrations.accessControlDesc"),
        status: "connected",
        detail: t("admin:integrations.roleChecksActive"),
        icon: ShieldCheck,
      },
    ];
  }, [paymentGateway?.isEnabled, t]);

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
  const connectedCount = integrations.filter((integration) => integration.status === "connected").length;

  const apiKeys = [
    { name: t("admin:integrations.adminApi"), scope: t("admin:integrations.adminApiScope"), status: t("admin:integrations.active"), lastUsed: t("admin:integrations.currentSession") },
    { name: t("admin:integrations.paymentCallback"), scope: t("admin:integrations.paymentCallbackScope"), status: paymentGateway?.isEnabled === false ? t("admin:integrations.paused") : t("admin:integrations.active"), lastUsed: paymentGateway?.updatedAt || t("admin:integrations.notAvailable") },
    { name: t("admin:integrations.reportExport"), scope: t("admin:integrations.reportExportScope"), status: t("admin:integrations.active"), lastUsed: t("admin:integrations.onDemand") },
  ];

  const activityRows = auditEvents
    .filter((event) => event.entityType.toLowerCase().includes("charge") || event.action.toLowerCase().includes("settings"))
    .slice(0, 6);

  if (chargeTypesQuery.isError || auditQuery.isError) {
    return (
      <Card className="max-w-xl border-red-200 bg-red-50">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900">{t("admin:integrations.errorTitle")}</h3>
              <p className="text-sm text-red-700">{t("admin:integrations.errorDescription")}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <WorkspaceLayout
      left={
        <>
          {/* Header */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-slate-900">{t("admin:integrations.title")}</h1>
                  <Badge className="bg-emerald-100 text-emerald-700">{t("admin:badge")}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {t("admin:integrations.subtitle")}
                </p>
              </div>
              <Button
                variant="outline"
                className="gap-2 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50"
                onClick={() => navigate("/admin/settings")}
              >
                <RefreshCw className="h-4 w-4" />
                {t("admin:integrations.checkStatus")}
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{t("admin:integrations.totalIntegrations")}</p>
                    <p className="text-2xl font-bold text-slate-900">{integrations.length}</p>
                  </div>
                  <Plug className="h-8 w-8 text-slate-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{t("admin:integrations.connected")}</p>
                    <p className="text-2xl font-bold text-emerald-600">{connectedCount}</p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{t("admin:integrations.needsReview")}</p>
                    <p className="text-2xl font-bold text-yellow-600">{openIssues}</p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-yellow-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{t("admin:integrations.apiKeysActive")}</p>
                    <p className="text-2xl font-bold text-blue-600">{apiKeys.filter(k => k.status === t("admin:integrations.active")).length}</p>
                  </div>
                  <KeyRound className="h-8 w-8 text-blue-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Category Filter */}
          <div>
            <Select value={category} onValueChange={(value) => setCategory(value as IntegrationCategory)}>
              <SelectTrigger className="w-[220px] border-slate-200">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder={t("admin:integrations.filterByCategory")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin:integrations.allIntegrations")}</SelectItem>
                <SelectItem value="payments">{t("admin:integrations.category.payments")}</SelectItem>
                <SelectItem value="messaging">{t("admin:integrations.category.messaging")}</SelectItem>
                <SelectItem value="data">{t("admin:integrations.category.data")}</SelectItem>
                <SelectItem value="security">{t("admin:integrations.category.security")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Integration Cards */}
          <div className="space-y-6">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent"></div>
                <p className="mt-2 text-sm text-slate-500">{t("admin:integrations.loading")}</p>
              </div>
            ) : filteredIntegrations.length === 0 ? (
              <Card className="border-slate-200 bg-white">
                <CardContent className="p-12 text-center">
                  <Plug className="mx-auto h-12 w-12 text-slate-300" />
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">{t("admin:integrations.noIntegrationsFound")}</h3>
                  <p className="mt-1 text-sm text-slate-500">{t("admin:integrations.noIntegrationsDescription")}</p>
                </CardContent>
              </Card>
            ) : (
              (Object.keys(groupedIntegrations) as Array<Exclude<IntegrationCategory, "all">>)
                .filter((groupKey) => groupedIntegrations[groupKey].length > 0)
                .map((groupKey) => (
                  <Card key={groupKey} className="border-slate-200 bg-white">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-slate-900">{t(categoryLabels[groupKey])}</CardTitle>
                          <CardDescription className="text-slate-500">
                            {groupedIntegrations[groupKey].length} {t("admin:integrations.connection", { count: groupedIntegrations[groupKey].length })}
                          </CardDescription>
                        </div>
                        {groupedIntegrations[groupKey].filter((item) => item.status === "attention").length > 0 && (
                          <Badge variant="outline" className="border-yellow-200 bg-yellow-50 text-yellow-700">
                            {groupedIntegrations[groupKey].filter((item) => item.status === "attention").length} {t("admin:integrations.needsReviewBadge")}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {groupedIntegrations[groupKey].map((integration) => {
                        const StatusIcon = statusConfig[integration.status].icon;
                        return (
                          <div
                            key={integration.name}
                            className="flex flex-col gap-4 rounded-lg border border-slate-200 p-4 transition-all hover:shadow-md md:flex-row md:items-center md:justify-between"
                          >
                            <div className="flex min-w-0 flex-1 items-start gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                                <integration.icon className="h-5 w-5 text-slate-600" />
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-semibold text-slate-900">{integration.name}</h3>
                                <p className="mt-1 text-sm text-slate-500">{integration.description}</p>
                                <p className="mt-1 text-xs text-slate-400">{integration.detail}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge className={statusConfig[integration.status].className}>
                                <StatusIcon className="mr-1 h-3 w-3" />
                                {t(statusConfig[integration.status].label)}
                              </Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-slate-200 hover:border-emerald-300 hover:bg-emerald-50"
                                onClick={() => navigate(integrationPaths[integration.name] || "/admin/settings")}
                              >
                                {t("admin:integrations.manage")}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                ))
            )}
          </div>
        </>
      }
      right={
        <div className="space-y-6">
          {/* Connection Controls */}
          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-slate-900">{t("admin:integrations.connectionControls")}</CardTitle>
                <Plug className="h-5 w-5 text-slate-400" />
              </div>
              <CardDescription className="text-slate-500">
                {t("admin:integrations.connectionControlsDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                [t("admin:integrations.paymentCallbacks"), paymentGateway?.isEnabled !== false],
                [t("admin:integrations.reportExports"), true],
                [t("admin:integrations.staffNotifications"), true],
              ].map(([label, checked]) => (
                <div key={String(label)} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/30 px-3 py-2">
                  <span className="text-sm text-slate-700">{label}</span>
                  <Switch
                    checked={Boolean(checked)}
                    disabled
                    aria-label={`${String(label)} — ${t("admin:integrations.readOnly")}`}
                    className="data-[state=checked]:bg-emerald-600"
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* API Keys */}
          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <CardTitle className="text-slate-900">{t("admin:integrations.apiKeys")}</CardTitle>
              <CardDescription className="text-slate-500">{t("admin:integrations.apiKeysDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200 bg-slate-50">
                      <TableHead className="font-semibold">{t("admin:integrations.name")}</TableHead>
                      <TableHead className="font-semibold">{t("common:status")}</TableHead>
                      <TableHead className="font-semibold">{t("admin:integrations.lastUsed")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeys.map((key) => (
                      <TableRow key={key.name} className="border-slate-100">
                        <TableCell>
                          <div className="flex items-start gap-2">
                            <KeyRound className="mt-0.5 h-4 w-4 text-slate-400" />
                            <div>
                              <span className="block font-medium text-slate-900">{key.name}</span>
                              <span className="block text-xs text-slate-500">{key.scope}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={key.status === t("admin:integrations.active") ? "bg-emerald-100 text-emerald-700" : "bg-yellow-100 text-yellow-700"}>
                            {key.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {key.lastUsed === t("admin:integrations.currentSession") || key.lastUsed === t("admin:integrations.onDemand") || key.lastUsed === t("admin:integrations.notAvailable")
                            ? key.lastUsed
                            : formatHumanDateTime(key.lastUsed)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Integration Activity */}
          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <CardTitle className="text-slate-900">{t("admin:integrations.integrationActivity")}</CardTitle>
              <CardDescription className="text-slate-500">{t("admin:integrations.integrationActivityDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activityRows.length === 0 ? (
                  <div className="rounded-lg bg-slate-50 p-6 text-center">
                    <p className="text-sm text-slate-500">{t("admin:integrations.noIntegrationActivity")}</p>
                  </div>
                ) : (
                  activityRows.map((event) => (
                    <div key={event.id} className="rounded-lg border border-slate-200 bg-slate-50/30 p-3">
                      <p className="text-sm font-medium capitalize text-slate-900">
                        {tSnake(t, event.action)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {event.actorName} - {formatHumanDateTime(event.createdAt)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      }
    />
  );
};

export default AdminIntegrationsPage;
