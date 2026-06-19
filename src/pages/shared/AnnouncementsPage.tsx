import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, AlertCircle, Bell, Send } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { cn, formatHumanDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageLayout } from "@/components/PageLayout";
import { EmptyState } from "@/components/ui/EmptyState";
import { DataTable } from "@/components/ui/DataTable";
import type { Announcement, AnnouncementAudience, AnnouncementPriority } from "@/types";

// ─── Constants ───────────────────────────────────────────
const priorityLabelKeys: Record<AnnouncementPriority, string> = { low: "announcements:priorityLow", normal: "announcements:priorityNormal", high: "announcements:priorityHigh" };
const audienceLabelKeys: Record<AnnouncementAudience, string> = { all: "announcements:audienceAll", vendors: "announcements:audienceVendors", staff: "announcements:audienceStaff" };

const priorityClasses: Record<AnnouncementPriority, string> = {
  high: "border-red-200 bg-red-50 text-red-700",
  normal: "border-blue-200 bg-blue-50 text-blue-700",
  low: "border-slate-200 bg-slate-50 text-slate-600",
};

const formatExpiry = (announcement: Announcement, t: (key: string) => string) => {
  if (announcement.archivedAt) return t("announcements:archivedDate", { date: formatHumanDateTime(announcement.archivedAt) });
  if (announcement.expiresAt) return t("announcements:expiresDate", { date: formatHumanDateTime(announcement.expiresAt) });
  return t("announcements:noExpiry");
};

// ─── Announcement card ────────────────────────────────────
const AnnouncementCard = ({
  announcement,
  canManage,
  onArchive,
  archiving,
}: {
  announcement: Announcement;
  canManage: boolean;
  onArchive: (id: string) => void;
  archiving: boolean;
}) => {
  const { t } = useTranslation();
  return (
  <Card className={cn("enterprise-card p-4", announcement.priority === "high" && announcement.active && "border-red-200 bg-red-50/30")}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {announcement.priority === "high" && announcement.active && (
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertCircle className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`rounded-lg border px-2 py-0.5 text-[11px] font-bold ${priorityClasses[announcement.priority]}`}>
              {t(priorityLabelKeys[announcement.priority])}
            </span>
            <span className="rounded-lg border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {t(audienceLabelKeys[announcement.audience])}
            </span>
            <span className="text-xs text-slate-400">{announcement.marketName || t("common:allMarkets")}</span>
          </div>
          <h3 className="font-bold text-slate-900">{announcement.title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">{announcement.body}</p>
        </div>
      </div>
      {canManage && announcement.active && (
        <Button variant="outline" size="sm" className="shrink-0 gap-2 rounded-lg border-slate-300 font-bold" disabled={archiving} onClick={() => onArchive(announcement.id)}>
          <Archive className="h-4 w-4" />
          Archive
        </Button>
      )}
    </div>

    <div className="mt-4 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-3 text-xs">
      {[
        { label: t("announcements:publishedBy"), value: `${announcement.createdByName} (${announcement.createdByRole})` },
        { label: t("announcements:published"), value: formatHumanDateTime(announcement.createdAt) },
        { label: t("announcements:lifecycle"), value: formatExpiry(announcement, t) },
      ].map((field) => (
        <div key={field.label} className="rounded-lg border border-slate-100 bg-slate-50 p-2">
          <p className="text-slate-400">{field.label}</p>
          <p className="mt-1 font-semibold text-slate-700">{field.value}</p>
        </div>
      ))}
    </div>
  </Card>
);
};

// ─── Page ─────────────────────────────────────────────────
const AnnouncementsPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = Boolean(user && ["manager", "official", "admin"].includes(user.role));
  const isManager = user?.role === "manager";
  const isVendor = user?.role === "vendor";

  const [selectedMarketId, setSelectedMarketId] = useState(isManager ? user?.marketId || "" : "all");
  const [form, setForm] = useState({
    title: "",
    body: "",
    priority: "normal" as AnnouncementPriority,
    audience: "vendors" as AnnouncementAudience,
    marketId: isManager ? user?.marketId || "" : "all",
    expiresAt: "",
  });

  useEffect(() => {
    if (!isManager) return;
    setSelectedMarketId(user?.marketId || "");
    setForm((c) => ({ ...c, marketId: user?.marketId || "" }));
  }, [isManager, user?.marketId]);

  const marketScope = isVendor ? undefined : isManager ? user?.marketId || undefined : selectedMarketId === "all" ? undefined : selectedMarketId;

  const announcementsQuery = useQuery({
    queryKey: ["announcements", user?.role, marketScope || "all"],
    queryFn: () => api.getAnnouncements({ marketId: marketScope, active: isVendor }),
    enabled: Boolean(user),
  });

  const marketsQuery = useQuery({
    queryKey: ["markets", "announcements"],
    queryFn: () => api.getMarkets(),
    enabled: Boolean(user && !isManager && !isVendor),
  });

  const createAnnouncement = useMutation({
    mutationFn: () => api.createAnnouncement({
      title: form.title.trim(), body: form.body.trim(), priority: form.priority,
      audience: form.audience, marketId: isManager ? user?.marketId || null : form.marketId === "all" ? null : form.marketId,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
    }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["announcements"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setForm((c) => ({ ...c, title: "", body: "", priority: "normal", audience: "vendors", expiresAt: "" }));
      toast.success(t("announcements:noticePublished"), { description: t("announcements:recipientsQueued", { n: result.delivery.recipientCount }) });
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : t("announcements:publishError");
      toast.error(t("announcements:noticeNotPublished"), { description: message });
    },
  });

  const archiveAnnouncement = useMutation({
    mutationFn: (announcementId: string) => api.archiveAnnouncement(announcementId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["announcements"] });
      toast.success(t("announcements:noticeArchived"));
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : t("announcements:archiveError");
      toast.error(t("announcements:noticeNotArchived"), { description: message });
    },
  });

  const announcements = announcementsQuery.data?.announcements || [];
  const markets = marketsQuery.data?.markets || [];
  const activeAnnouncements = announcements.filter((a) => a.active);
  const historicalAnnouncements = announcements.filter((a) => !a.active);
  const canSubmit = canManage && form.title.trim().length > 0 && form.body.trim().length > 0 && (!isManager || Boolean(user?.marketId));

  return (
    <PageLayout>
      <PageHeader
        eyebrow={isVendor ? t("announcements:vendorEyebrow") : t("announcements:otherEyebrow")}
        title={t("announcements:title")}
        description={isVendor ? t("announcements:vendorSubtitle") : t("announcements:otherSubtitle")}
        actions={
          !isVendor && !isManager ? (
            <select value={selectedMarketId} onChange={(e) => setSelectedMarketId(e.target.value)} className="h-9 rounded-lg border-2 border-slate-300 bg-white px-3 text-sm focus:border-primary focus:outline-none">
              <option value="all">{t("common:allMarkets")}</option>
              {markets.map((market) => <option key={market.id} value={market.id}>{market.name}</option>)}
            </select>
          ) : !isVendor && isManager ? (
            <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
              {user?.marketName || t("common:assignedMarket")}
            </div>
          ) : undefined
        }
      />

      {/* Summary */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={activeAnnouncements.length > 0 ? "warning" : "success"}>{t("announcements:activeBadge", { n: activeAnnouncements.length })}</Badge>
        {!isVendor && <Badge variant="secondary">{t("announcements:archivedBadge", { n: historicalAnnouncements.length })}</Badge>}
        <span className="text-xs text-slate-500">{user?.marketName || (isVendor ? t("common:assignedMarket") : t("common:allMarkets"))}</span>
      </div>

      <div className={cn("grid gap-6", canManage && "xl:grid-cols-[minmax(0,1fr)_380px]")}>
        {/* Active notices */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
              <CardTitle className="text-base font-medium">{t("announcements:activeNotices")}</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
            {announcementsQuery.isPending ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <div key={i} className="h-24 rounded-lg bg-slate-100 animate-pulse" />)}
              </div>
            ) : activeAnnouncements.length === 0 ? (
              <EmptyState title={t("announcements:noActiveNotices")} />
            ) : (() => {
              const urgent = activeAnnouncements.filter((a) => a.priority === "high");
              const other = activeAnnouncements.filter((a) => a.priority !== "high");
              return (
                <div className="space-y-5">
                  {urgent.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-600">
                        <Bell className="h-3.5 w-3.5" /> {t("announcements:urgent")}
                      </div>
                      {urgent.map((announcement) => (
                        <AnnouncementCard key={announcement.id} announcement={announcement} canManage={canManage} onArchive={(id) => archiveAnnouncement.mutate(id)} archiving={archiveAnnouncement.isPending} />
                      ))}
                    </div>
                  )}
                  {other.length > 0 && (
                    <div className="space-y-3">
                      {urgent.length > 0 && <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{t("announcements:otherNotices")}</div>}
                      {other.map((announcement) => (
                        <AnnouncementCard key={announcement.id} announcement={announcement} canManage={canManage} onArchive={(id) => archiveAnnouncement.mutate(id)} archiving={archiveAnnouncement.isPending} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
            </CardContent>
          </Card>

          {!isVendor && (
            <Card>
              <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
                <CardTitle className="text-base font-medium">{t("announcements:archivedNotices")}</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
              <DataTable
                columns={[
                  { key: "subject", header: t("announcements:title"), cell: (a) => <span className="font-medium text-[#111827]">{a.title}</span> },
                  { key: "priority", header: t("announcements:priority"), cell: (a) => <span className={cn("rounded-lg border px-2 py-0.5 text-[11px] font-bold", priorityClasses[a.priority])}>{t(priorityLabelKeys[a.priority])}</span> },
                  { key: "audience", header: t("announcements:audience"), cell: (a) => <span className="rounded-lg border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{t(audienceLabelKeys[a.audience])}</span> },
                  { key: "date", header: t("announcements:published"), cell: (a) => <span className="text-[#6B7280]">{formatHumanDateTime(a.createdAt)}</span> },
                  { key: "lifecycle", header: t("announcements:lifecycle"), cell: (a) => <span className="text-[#6B7280]">{formatExpiry(a, t)}</span> },
                ]}
                data={historicalAnnouncements}
                keyExtractor={(a) => a.id}
                emptyState={<EmptyState title={t("announcements:noArchivedNotices")} />}
              />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Compose panel */}
        {canManage && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
                <CardTitle className="text-base font-medium">{t("announcements:publishNotice")}</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="announce-title" className="font-bold text-slate-700">{t("announcements:title")}</Label>
                  <Input id="announce-title" className="border-2 border-slate-300 rounded-lg focus-visible:border-primary focus-visible:ring-0" maxLength={140} value={form.title} onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} placeholder={t("announcements:titlePlaceholder")} />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="announce-priority" className="font-bold text-slate-700">{t("announcements:priority")}</Label>
                    <Select value={form.priority} onValueChange={(v: AnnouncementPriority) => setForm((c) => ({ ...c, priority: v }))}>
                      <SelectTrigger id="announce-priority" className="border-slate-300 rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">{t("announcements:priorityLow")}</SelectItem>
                        <SelectItem value="normal">{t("announcements:priorityNormal")}</SelectItem>
                        <SelectItem value="high">{t("announcements:priorityHigh")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="announce-audience" className="font-bold text-slate-700">{t("announcements:audience")}</Label>
                    <Select value={form.audience} onValueChange={(v: AnnouncementAudience) => setForm((c) => ({ ...c, audience: v }))}>
                      <SelectTrigger id="announce-audience" className="border-slate-300 rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vendors">{t("announcements:audienceVendors")}</SelectItem>
                        <SelectItem value="staff">{t("announcements:audienceStaff")}</SelectItem>
                        <SelectItem value="all">{t("announcements:audienceAll")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="announce-expiry" className="font-bold text-slate-700">{t("announcements:expiry")}</Label>
                    <Input id="announce-expiry" type="datetime-local" className="border-slate-300 rounded-lg focus-visible:border-primary focus-visible:ring-0" value={form.expiresAt} onChange={(e) => setForm((c) => ({ ...c, expiresAt: e.target.value }))} />
                  </div>
                </div>

                {!isManager && (
                  <div className="space-y-1.5">
                    <Label htmlFor="announce-market" className="font-bold text-slate-700">{t("announcements:targetMarket")}</Label>
                    <Select value={form.marketId} onValueChange={(v) => setForm((c) => ({ ...c, marketId: v }))}>
                      <SelectTrigger id="announce-market" className="border-slate-300 rounded-lg"><SelectValue placeholder={t("common:allMarkets")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("common:allMarkets")}</SelectItem>
                        {markets.map((market) => <SelectItem key={market.id} value={market.id}>{market.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="announce-message" className="font-bold text-slate-700">{t("announcements:message")}</Label>
                    <span className={`text-xs ${form.body.length > 1800 ? "text-amber-600" : "text-slate-500"}`}>{t("announcements:charCount", { n: form.body.length })}</span>
                  </div>
                  <Textarea id="announce-message" className="border-slate-300 rounded-lg focus-visible:border-primary focus-visible:ring-0" rows={5} maxLength={2000} value={form.body} onChange={(e) => setForm((c) => ({ ...c, body: e.target.value }))} placeholder={t("announcements:messagePlaceholder")} />
                </div>

                <Button className="w-full gap-2 rounded-lg shadow-none bg-primary hover:bg-primary/90 font-bold" disabled={!canSubmit || createAnnouncement.isPending} onClick={() => createAnnouncement.mutate()}>
                  <Send className="h-4 w-4" />
                  {createAnnouncement.isPending ? t("announcements:publishing") : t("announcements:publishButton")}
                </Button>
              </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default AnnouncementsPage;
