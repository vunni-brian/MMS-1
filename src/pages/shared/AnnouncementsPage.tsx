import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Send } from "lucide-react";

import { DashboardErrorBoundary } from "@/components/DashboardErrorBoundary";
import {
  ConsolePage,
  EmptyState,
  EvidenceField,
  FormSection,
  LoadingState,
  PageHeader,
  Panel,
  RecordCard,
  ScopeBar,
  ScopeItem,
} from "@/components/console/ConsolePage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { cn, formatHumanDateTime } from "@/lib/utils";
import type { Announcement, AnnouncementAudience, AnnouncementPriority } from "@/types";

const priorityLabels: Record<AnnouncementPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
};

const audienceLabels: Record<AnnouncementAudience, string> = {
  all: "All users",
  vendors: "Vendors",
  staff: "Staff",
};

const priorityClassName = (priority: AnnouncementPriority) => {
  if (priority === "high") return "border-destructive/20 bg-destructive/15 text-destructive";
  if (priority === "normal") return "border-info/20 bg-info/10 text-info";
  return "border-border bg-muted text-muted-foreground";
};

const formatExpiry = (announcement: Announcement) => {
  if (announcement.archivedAt) return `Archived ${formatHumanDateTime(announcement.archivedAt)}`;
  if (announcement.expiresAt) return `Expires ${formatHumanDateTime(announcement.expiresAt)}`;
  return "No expiry";
};

const AnnouncementCard = ({
  announcement,
  canManage,
  onArchive,
  archiving,
}: {
  announcement: Announcement;
  canManage: boolean;
  onArchive: (announcementId: string) => void;
  archiving: boolean;
}) => (
  <RecordCard className={cn("p-3", announcement.priority === "high" && announcement.active && "border-destructive/25 bg-destructive/5")}>
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("status-badge", priorityClassName(announcement.priority))}>
            {priorityLabels[announcement.priority]}
          </span>
          <span className="status-badge border-border bg-muted text-muted-foreground">
            {audienceLabels[announcement.audience]}
          </span>
          <span className="text-xs text-muted-foreground">
            {announcement.marketName || "All markets"}
          </span>
        </div>
        <h3 className="mt-2 text-sm font-semibold leading-5">{announcement.title}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{announcement.body}</p>
      </div>

      {canManage && announcement.active && (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-2"
          disabled={archiving}
          onClick={() => onArchive(announcement.id)}
        >
          <Archive className="h-4 w-4" />
          Archive
        </Button>
      )}
    </div>

    <div className="mt-3 grid gap-3 border-t border-border/70 pt-3 sm:grid-cols-3">
      <EvidenceField label="Published by" value={`${announcement.createdByName} (${announcement.createdByRole})`} />
      <EvidenceField label="Published" value={formatHumanDateTime(announcement.createdAt)} />
      <EvidenceField label="Lifecycle" value={formatExpiry(announcement)} />
    </div>
  </RecordCard>
);

const AnnouncementsPage = () => {
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
    setForm((current) => ({ ...current, marketId: user?.marketId || "" }));
  }, [isManager, user?.marketId]);

  const marketScope =
    isVendor
      ? undefined
      : isManager
        ? user?.marketId || undefined
        : selectedMarketId === "all"
          ? undefined
          : selectedMarketId;

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
    mutationFn: () =>
      api.createAnnouncement({
        title: form.title.trim(),
        body: form.body.trim(),
        priority: form.priority,
        audience: form.audience,
        marketId:
          isManager
            ? user?.marketId || null
            : form.marketId === "all"
              ? null
              : form.marketId,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["announcements"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setForm((current) => ({
        ...current,
        title: "",
        body: "",
        priority: "normal",
        audience: "vendors",
        expiresAt: "",
      }));
      toast.success("Notice published", {
        description: `${result.delivery.recipientCount} notification recipient(s) queued.`,
      });
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : "Unable to publish notice.";
      toast.error("Notice was not published", { description: message });
    },
  });

  const archiveAnnouncement = useMutation({
    mutationFn: (announcementId: string) => api.archiveAnnouncement(announcementId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["announcements"] });
      toast.success("Notice archived");
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : "Unable to archive notice.";
      toast.error("Notice was not archived", { description: message });
    },
  });

  const announcements = announcementsQuery.data?.announcements || [];
  const markets = marketsQuery.data?.markets || [];
  const activeAnnouncements = announcements.filter((announcement) => announcement.active);
  const historicalAnnouncements = announcements.filter((announcement) => !announcement.active);

  const pageLoading = announcementsQuery.isPending || (!isManager && !isVendor && marketsQuery.isPending);
  const canSubmit =
    canManage &&
    form.title.trim().length > 0 &&
    form.body.trim().length > 0 &&
    (!isManager || Boolean(user?.marketId));

  if (pageLoading) {
    return (
      <ConsolePage>
        <LoadingState rows={1} itemClassName="h-28 rounded-xl" />
        <LoadingState rows={4} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" itemClassName="h-28 rounded-xl" />
        <LoadingState rows={2} itemClassName="h-64 rounded-xl" />
      </ConsolePage>
    );
  }

  return (
    <ConsolePage>
      <PageHeader
        eyebrow={isVendor ? "Vendor notices" : "News and alerts"}
        title="Notices"
        description={
          isVendor
            ? "Active market notices, deadlines, inspections, and changes."
            : "Publish and monitor market-wide news and alerts for vendors and staff."
        }
        meta={
          <>
            <span className="rounded-full bg-muted px-2.5 py-1">
              {user?.marketName || (isVendor ? "Assigned market" : "All markets")}
            </span>
            <span className="rounded-full bg-muted px-2.5 py-1">{activeAnnouncements.length} active</span>
          </>
        }
      />

      {!isVendor && (
        <ScopeBar>
          {!isManager ? (
            <ScopeItem label="Market scope" className="w-full lg:w-[260px]">
              <Select value={selectedMarketId} onValueChange={setSelectedMarketId}>
                <SelectTrigger id="announcement-market-filter">
                  <SelectValue placeholder="All markets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All markets</SelectItem>
                  {markets.map((market) => (
                    <SelectItem key={market.id} value={market.id}>
                      {market.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ScopeItem>
          ) : (
            <ScopeItem label="Market scope">
              <div className="rounded-md border border-border/70 bg-background px-3 py-2 text-sm">
                {user?.marketName || "Assigned market"}
              </div>
            </ScopeItem>
          )}
        </ScopeBar>
      )}

      <div className="notices-workspace-grid">
      {canManage && (
        <DashboardErrorBoundary>
          <FormSection
            className="notices-compose-panel workspace-secondary-panel"
            title="Publish Notice"
            description="Send an active notice to vendors, staff, or the whole market network."
            actions={<Send className="h-5 w-5 text-muted-foreground" />}
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="announcement-title">Title</Label>
                <Input
                  id="announcement-title"
                  value={form.title}
                  maxLength={140}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="e.g. Sanitation inspection this Friday"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="announcement-priority">Priority</Label>
                  <Select
                    value={form.priority}
                    onValueChange={(value: AnnouncementPriority) => setForm((current) => ({ ...current, priority: value }))}
                  >
                    <SelectTrigger id="announcement-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="announcement-audience">Audience</Label>
                  <Select
                    value={form.audience}
                    onValueChange={(value: AnnouncementAudience) => setForm((current) => ({ ...current, audience: value }))}
                  >
                    <SelectTrigger id="announcement-audience">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vendors">Vendors</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="all">All users</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="announcement-expiry">Expiry</Label>
                  <Input
                    id="announcement-expiry"
                    type="datetime-local"
                    value={form.expiresAt}
                    onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))}
                  />
                </div>
              </div>

              {!isManager && (
                <div className="space-y-1.5">
                  <Label htmlFor="announcement-market">Target market</Label>
                  <Select
                    value={form.marketId}
                    onValueChange={(value) => setForm((current) => ({ ...current, marketId: value }))}
                  >
                    <SelectTrigger id="announcement-market">
                      <SelectValue placeholder="All markets" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All markets</SelectItem>
                      {markets.map((market) => (
                        <SelectItem key={market.id} value={market.id}>
                          {market.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className={cn("space-y-1.5", isManager ? "lg:col-span-2" : "")}>
                <div className="flex items-center justify-between">
                  <Label htmlFor="announcement-body">Message</Label>
                  <span className={`text-xs ${form.body.length > 1800 ? "text-warning" : "text-muted-foreground"}`}>
                    {form.body.length} / 2000
                  </span>
                </div>
                <Textarea
                  id="announcement-body"
                  rows={4}
                  value={form.body}
                  maxLength={2000}
                  onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
                  placeholder="Write the notice vendors or staff need to act on."
                />
              </div>

              <div className="lg:col-span-2">
                <Button
                  className="w-full gap-2 sm:w-auto"
                  disabled={!canSubmit || createAnnouncement.isPending}
                  onClick={() => createAnnouncement.mutate()}
                >
                  <Send className="h-4 w-4" />
                  {createAnnouncement.isPending ? "Publishing..." : "Publish Notice"}
                </Button>
              </div>
            </div>
          </FormSection>
        </DashboardErrorBoundary>
      )}

      <DashboardErrorBoundary>
        <Panel className="notices-primary-panel workspace-dominant-panel" title="Active Notices" description="Currently visible notices." contentClassName="space-y-3">
          {activeAnnouncements.length === 0 ? (
            <EmptyState title="No active notices" description="Important notices will appear here when published." />
          ) : (
            activeAnnouncements.map((announcement) => (
              <AnnouncementCard
                key={announcement.id}
                announcement={announcement}
                canManage={canManage}
                onArchive={(announcementId) => archiveAnnouncement.mutate(announcementId)}
                archiving={archiveAnnouncement.isPending}
              />
            ))
          )}
        </Panel>
      </DashboardErrorBoundary>

      {!isVendor && (
        <DashboardErrorBoundary>
          <Panel className="workspace-secondary-panel" title="Archived Notices" description="Notices that are no longer active." contentClassName="space-y-3">
            {historicalAnnouncements.length === 0 ? (
              <EmptyState title="No historical notices" />
            ) : (
              historicalAnnouncements.map((announcement) => (
                <AnnouncementCard
                  key={announcement.id}
                  announcement={announcement}
                  canManage={false}
                  onArchive={() => undefined}
                  archiving={false}
                />
              ))
            )}
          </Panel>
        </DashboardErrorBoundary>
      )}
      </div>
    </ConsolePage>
  );
};

export default AnnouncementsPage;
