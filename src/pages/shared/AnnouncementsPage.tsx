import { useEffect, useState } from "react";
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
import { MockupCard, MockupHeader, MockupPage, MockupPanel, StatusPill } from "@/components/mockup/MockupUI";
import type { Announcement, AnnouncementAudience, AnnouncementPriority } from "@/types";

// ─── Constants ───────────────────────────────────────────
const priorityLabels: Record<AnnouncementPriority, string> = { low: "Low", normal: "Normal", high: "High" };
const audienceLabels: Record<AnnouncementAudience, string> = { all: "All users", vendors: "Vendors", staff: "Staff" };

const priorityClasses: Record<AnnouncementPriority, string> = {
  high: "border-red-200 bg-red-50 text-red-700",
  normal: "border-blue-200 bg-blue-50 text-blue-700",
  low: "border-slate-200 bg-slate-50 text-slate-600",
};

const formatExpiry = (announcement: Announcement) => {
  if (announcement.archivedAt) return `Archived ${formatHumanDateTime(announcement.archivedAt)}`;
  if (announcement.expiresAt) return `Expires ${formatHumanDateTime(announcement.expiresAt)}`;
  return "No expiry";
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
}) => (
  <MockupCard className={cn("p-4", announcement.priority === "high" && announcement.active && "border-red-200 bg-red-50/30")}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {announcement.priority === "high" && announcement.active && (
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertCircle className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`rounded-sm border px-2 py-0.5 text-[11px] font-bold ${priorityClasses[announcement.priority]}`}>
              {priorityLabels[announcement.priority]}
            </span>
            <span className="rounded-sm border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {audienceLabels[announcement.audience]}
            </span>
            <span className="text-xs text-slate-400">{announcement.marketName || "All markets"}</span>
          </div>
          <h3 className="font-bold text-slate-900">{announcement.title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">{announcement.body}</p>
        </div>
      </div>
      {canManage && announcement.active && (
        <Button variant="outline" size="sm" className="shrink-0 gap-2 rounded-sm border-slate-300 font-bold" disabled={archiving} onClick={() => onArchive(announcement.id)}>
          <Archive className="h-4 w-4" />
          Archive
        </Button>
      )}
    </div>

    <div className="mt-4 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-3 text-xs">
      {[
        { label: "Published by", value: `${announcement.createdByName} (${announcement.createdByRole})` },
        { label: "Published", value: formatHumanDateTime(announcement.createdAt) },
        { label: "Lifecycle", value: formatExpiry(announcement) },
      ].map((field) => (
        <div key={field.label} className="rounded-sm border border-slate-100 bg-slate-50 p-2">
          <p className="text-slate-400">{field.label}</p>
          <p className="mt-1 font-semibold text-slate-700">{field.value}</p>
        </div>
      ))}
    </div>
  </MockupCard>
);

// ─── Page ─────────────────────────────────────────────────
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
      toast.success("Notice published", { description: `${result.delivery.recipientCount} recipient(s) queued.` });
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
  const activeAnnouncements = announcements.filter((a) => a.active);
  const historicalAnnouncements = announcements.filter((a) => !a.active);
  const canSubmit = canManage && form.title.trim().length > 0 && form.body.trim().length > 0 && (!isManager || Boolean(user?.marketId));

  return (
    <MockupPage>
      <MockupHeader
        eyebrow={isVendor ? "Vendor notices" : "News and alerts"}
        title="Notices"
        subtitle={isVendor ? "Active market notices, deadlines, inspections, and changes." : "Publish and monitor market-wide news and alerts for vendors and staff."}
        actions={
          !isVendor && !isManager ? (
            <select value={selectedMarketId} onChange={(e) => setSelectedMarketId(e.target.value)} className="h-9 rounded-sm border-2 border-slate-300 bg-white px-3 text-sm focus:border-primary focus:outline-none">
              <option value="all">All markets</option>
              {markets.map((market) => <option key={market.id} value={market.id}>{market.name}</option>)}
            </select>
          ) : !isVendor && isManager ? (
            <div className="flex h-9 items-center rounded-sm border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
              {user?.marketName || "Assigned market"}
            </div>
          ) : undefined
        }
      />

      {/* Summary */}
      <div className="flex flex-wrap items-center gap-3">
        <StatusPill tone={activeAnnouncements.length > 0 ? "amber" : "green"}>{activeAnnouncements.length} active</StatusPill>
        {!isVendor && <StatusPill tone="slate">{historicalAnnouncements.length} archived</StatusPill>}
        <span className="text-xs text-slate-500">{user?.marketName || (isVendor ? "Assigned market" : "All markets")}</span>
      </div>

      <div className={cn("grid gap-6", canManage && "xl:grid-cols-[minmax(0,1fr)_380px]")}>
        {/* Active notices */}
        <div className="space-y-4">
          <MockupPanel title="Active Notices">
            {announcementsQuery.isPending ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <div key={i} className="h-24 rounded-sm bg-slate-100 animate-pulse" />)}
              </div>
            ) : activeAnnouncements.length === 0 ? (
              <div className="rounded-sm border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-400">
                No active notices. Important announcements will appear here when published.
              </div>
            ) : (() => {
              const urgent = activeAnnouncements.filter((a) => a.priority === "high");
              const other = activeAnnouncements.filter((a) => a.priority !== "high");
              return (
                <div className="space-y-5">
                  {urgent.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-600">
                        <Bell className="h-3.5 w-3.5" /> Urgent
                      </div>
                      {urgent.map((announcement) => (
                        <AnnouncementCard key={announcement.id} announcement={announcement} canManage={canManage} onArchive={(id) => archiveAnnouncement.mutate(id)} archiving={archiveAnnouncement.isPending} />
                      ))}
                    </div>
                  )}
                  {other.length > 0 && (
                    <div className="space-y-3">
                      {urgent.length > 0 && <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Other Notices</div>}
                      {other.map((announcement) => (
                        <AnnouncementCard key={announcement.id} announcement={announcement} canManage={canManage} onArchive={(id) => archiveAnnouncement.mutate(id)} archiving={archiveAnnouncement.isPending} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </MockupPanel>

          {!isVendor && (
            <MockupPanel title="Archived Notices">
              {historicalAnnouncements.length === 0 ? (
                <div className="rounded-sm border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-400">No archived notices.</div>
              ) : (
                <div className="space-y-3">
                  {historicalAnnouncements.map((announcement) => (
                    <AnnouncementCard key={announcement.id} announcement={announcement} canManage={false} onArchive={() => undefined} archiving={false} />
                  ))}
                </div>
              )}
            </MockupPanel>
          )}
        </div>

        {/* Compose panel */}
        {canManage && (
          <div className="space-y-4">
            <MockupPanel title="Publish Notice">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-700">Title</Label>
                  <Input className="border-2 border-slate-300 rounded-sm focus-visible:border-primary focus-visible:ring-0" maxLength={140} value={form.title} onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} placeholder="e.g. Sanitation inspection this Friday" />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="font-bold text-slate-700">Priority</Label>
                    <Select value={form.priority} onValueChange={(v: AnnouncementPriority) => setForm((c) => ({ ...c, priority: v }))}>
                      <SelectTrigger className="border-slate-300 rounded-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-bold text-slate-700">Audience</Label>
                    <Select value={form.audience} onValueChange={(v: AnnouncementAudience) => setForm((c) => ({ ...c, audience: v }))}>
                      <SelectTrigger className="border-slate-300 rounded-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vendors">Vendors</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="all">All users</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-bold text-slate-700">Expiry</Label>
                    <Input type="datetime-local" className="border-slate-300 rounded-sm focus-visible:border-primary focus-visible:ring-0" value={form.expiresAt} onChange={(e) => setForm((c) => ({ ...c, expiresAt: e.target.value }))} />
                  </div>
                </div>

                {!isManager && (
                  <div className="space-y-1.5">
                    <Label className="font-bold text-slate-700">Target market</Label>
                    <Select value={form.marketId} onValueChange={(v) => setForm((c) => ({ ...c, marketId: v }))}>
                      <SelectTrigger className="border-slate-300 rounded-sm"><SelectValue placeholder="All markets" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All markets</SelectItem>
                        {markets.map((market) => <SelectItem key={market.id} value={market.id}>{market.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="font-bold text-slate-700">Message</Label>
                    <span className={`text-xs ${form.body.length > 1800 ? "text-amber-600" : "text-slate-400"}`}>{form.body.length} / 2000</span>
                  </div>
                  <Textarea className="border-slate-300 rounded-sm focus-visible:border-primary focus-visible:ring-0" rows={5} maxLength={2000} value={form.body} onChange={(e) => setForm((c) => ({ ...c, body: e.target.value }))} placeholder="Write the notice vendors or staff need to act on." />
                </div>

                <Button className="w-full gap-2 rounded-sm shadow-none bg-primary hover:bg-primary/90 font-bold" disabled={!canSubmit || createAnnouncement.isPending} onClick={() => createAnnouncement.mutate()}>
                  <Send className="h-4 w-4" />
                  {createAnnouncement.isPending ? "Publishing..." : "Publish Notice"}
                </Button>
              </div>
            </MockupPanel>
          </div>
        )}
      </div>
    </MockupPage>
  );
};

export default AnnouncementsPage;
