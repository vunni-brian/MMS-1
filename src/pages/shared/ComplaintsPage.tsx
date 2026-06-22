/**
 * Shared complaints/ticket management page with status workflow, category/priority filtering,
 * SLA tracking, and escalation actions. Accessible to vendor and manager roles.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Filter,
  Lock,
  MessageSquare,
  Plus,
  Search,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { formatHumanDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileUploadCard } from "@/components/ui/FileUploadCard";
import { EmptyState as ConsoleEmptyState } from "@/components/ui/EmptyState";
import { DataTableFrame } from "@/components/ui/DataTableFrame";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { PageLayout } from "@/components/PageLayout";
import { StatCard } from "@/components/ui/StatCard";
import type { Ticket, TicketCategory, TicketPriority, TicketStatus } from "@/types";

// ─── Types ───────────────────────────────────────────────
/** Ticket status filter option. */
type StatusFilter = "all" | TicketStatus;
/** Ticket category filter option. */
type CategoryFilter = "all" | TicketCategory;
/** Ticket priority filter option. */
type PriorityFilter = "all" | TicketPriority;

// ─── Constants ───────────────────────────────────────────
const categoryLabelKeys: Record<TicketCategory, string> = {
  billing: "complaints:categories.billing", maintenance: "complaints:categories.maintenance", dispute: "complaints:categories.dispute",
  payment: "complaints:categories.payment", stall: "complaints:categories.stall", sanitation: "complaints:categories.sanitation",
  harassment: "complaints:categories.harassment", other: "complaints:categories.other",
};

const priorityLabelKeys: Record<TicketPriority, string> = {
  low: "complaints:priorities.low", medium: "complaints:priorities.medium", high: "complaints:priorities.high", urgent: "complaints:priorities.urgent",
};

const statusLabelKeys: Record<TicketStatus, string> = {
  open: "complaints:open", in_progress: "complaints:steps.inProgress", resolved: "complaints:resolved", closed: "complaints:closed",
};

const priorityClasses: Record<TicketPriority, string> = {
  urgent: "border-red-200 bg-red-50 text-red-700",
  high: "border-red-200 bg-red-50 text-red-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-slate-200 bg-slate-50 text-slate-600",
};

const complaintStepKeys = ["complaints:steps.submitted", "complaints:steps.inProgress", "complaints:steps.resolved", "complaints:steps.closed"];

const getStepIndex = (status: TicketStatus) => {
  if (status === "closed") return 3;
  if (status === "resolved") return 2;
  if (status === "in_progress") return 1;
  return 0;
};

const formatSla = (ticket: Ticket, t: (key: string) => string) => {
  if (!ticket.slaDueAt) return t("complaints:slaFallback");
  if (ticket.status === "resolved" || ticket.status === "closed") return t("complaints:slaCompleted");
  const diff = new Date(ticket.slaDueAt).getTime() - Date.now();
  const absHours = Math.ceil(Math.abs(diff) / (1000 * 60 * 60));
  if (diff < 0) return t("complaints:slaOverdue", { h: absHours });
  if (absHours < 24) return t("complaints:slaLeftHours", { h: absHours });
  return t("complaints:slaLeftDays", { d: Math.ceil(absHours / 24) });
};

const buildTimeline = (ticket: Ticket, t: (key: string) => string) => [
  { id: `${ticket.id}-created`, label: t("complaints:timelineCreated"), detail: `${ticket.ticketNumber} ${t("complaints:submitted")} by ${ticket.vendorName}.`, actor: ticket.vendorName, timestamp: ticket.createdAt, internal: false },
  ...ticket.updates.map((u) => ({ id: u.id, label: u.internal ? t("complaints:timelineNote") : u.status === ticket.status ? t("complaints:timelineUpdate") : t("complaints:timelineStatusChange"), detail: u.note, actor: u.actorName, timestamp: u.createdAt, internal: u.internal })),
  ...(ticket.escalatedAt ? [{ id: `${ticket.id}-esc`, label: t("complaints:timelineEscalated"), detail: ticket.escalationReason || t("complaints:escalationReason"), actor: ticket.assignedToName || t("complaints:actorSystem"), timestamp: ticket.escalatedAt, internal: true }] : []),
  ...(ticket.resolvedAt ? [{ id: `${ticket.id}-res`, label: t("complaints:timelineResolved"), detail: ticket.resolutionReference || `${ticket.ticketNumber}-RES`, actor: ticket.assignedToName || t("complaints:actorManager"), timestamp: ticket.resolvedAt, internal: false }] : []),
].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

const nextStatusOptions = (status: TicketStatus): Array<{ value: TicketStatus; labelKey: string }> => {
  const all: Array<{ value: TicketStatus; labelKey: string }> = [
    { value: "open", labelKey: "complaints:open" }, { value: "in_progress", labelKey: "complaints:steps.inProgress" },
    { value: "resolved", labelKey: "complaints:resolved" }, { value: "closed", labelKey: "complaints:closed" },
  ];
  if (status === "open") return all.filter((o) => ["open", "in_progress", "closed"].includes(o.value));
  if (status === "in_progress") return all.filter((o) => ["in_progress", "resolved", "closed"].includes(o.value));
  if (status === "resolved") return all.filter((o) => ["resolved", "closed"].includes(o.value));
  return all.filter((o) => o.value === "closed");
};

// ─── Sub-components ───────────────────────────────────────
/** Visual progress indicator showing the current ticket status in a multi-step workflow. */
const ComplaintProgress = ({ status }: { status: TicketStatus }) => {
  const { t } = useTranslation();
  const active = getStepIndex(status);
  return (
    <div className="space-y-2">
      <div className="relative h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${(active / (complaintStepKeys.length - 1)) * 100}%` }} />
      </div>
      <div className="grid grid-cols-4 gap-1 text-[11px] font-medium">
        {complaintStepKeys.map((stepKey, i) => (
          <span key={stepKey} className={`inline-flex items-center gap-1 ${i <= active ? "text-slate-900" : "text-slate-400"}`}>
            {i <= active && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
            {t(stepKey)}
          </span>
        ))}
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────
/** ComplaintsPage - renders the ticket management dashboard with create, filter, and workflow progression. */
const ComplaintsPage = () => {
  const { t } = useTranslation();
  const { role } = useAuth();
  const queryClient = useQueryClient();

  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");

  const [newTicket, setNewTicket] = useState<{
    category: TicketCategory; priority: TicketPriority;
    subject: string; description: string; attachment: File | null;
  }>({ category: "maintenance", priority: "medium", subject: "", description: "", attachment: null });

  const [managerUpdate, setManagerUpdate] = useState<{
    status: TicketStatus; resolutionNote: string; note: string; internal: boolean;
  }>({ status: "in_progress", resolutionNote: "", note: "", internal: false });

  const { data, isPending, isError } = useQuery({ queryKey: ["tickets"], queryFn: () => api.getTickets() });

  const createTicket = useMutation({
    mutationFn: () => api.createTicket(newTicket),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setShowNew(false);
      setNewTicket({ category: "maintenance", priority: "medium", subject: "", description: "", attachment: null });
      setError(null);
      toast.success(t("complaints:complaintSubmitted"), { description: t("complaints:complaintSubmittedDesc") });
    },
    onError: (e) => { const msg = e instanceof ApiError ? e.message : "Unable to create ticket."; setError(msg); toast.error(t("complaints:complaintNotSubmitted"), { description: msg }); },
  });

  const updateTicket = useMutation({
    mutationFn: () => api.updateTicket(selected!.ticketNumber, managerUpdate),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setSelected(null); setError(null);
      toast.success(t("complaints:ticketUpdated"));
    },
    onError: (e) => { const msg = e instanceof ApiError ? e.message : "Unable to update ticket."; setError(msg); toast.error(t("complaints:ticketNotUpdated"), { description: msg }); },
  });

  const escalateTicket = useMutation({
    mutationFn: () => api.escalateTicket(selected!.ticketNumber, managerUpdate.note.trim() || t("complaints:escalationFallback")),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setSelected(null); setError(null);
      toast.success(t("complaints:ticketEscalated"));
    },
    onError: (e) => { const msg = e instanceof ApiError ? e.message : "Unable to escalate ticket."; setError(msg); toast.error(t("complaints:ticketNotEscalated"), { description: msg }); },
  });

  const tickets = data?.tickets || [];

  const filteredTickets = tickets.filter((ticket) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || [ticket.ticketNumber, ticket.subject, ticket.description, ticket.vendorName || "", t(categoryLabelKeys[ticket.category]), t(statusLabelKeys[ticket.status]), t(priorityLabelKeys[ticket.priority])].join(" ").toLowerCase().includes(term);
    return matchesSearch && (statusFilter === "all" || ticket.status === statusFilter) && (categoryFilter === "all" || ticket.category === categoryFilter) && (priorityFilter === "all" || ticket.priority === priorityFilter);
  });

  const canSubmit = Boolean(newTicket.category && newTicket.subject.trim() && newTicket.description.trim().length >= 20);
  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;
  const breachedCount = tickets.filter((t) => t.breachedSla).length;
  const resolvedCount = tickets.filter((t) => ["resolved", "closed"].includes(t.status)).length;
  const requiresResolution = managerUpdate.status === "resolved" || managerUpdate.status === "closed";
  const canUpdate = Boolean(selected) && (!requiresResolution || Boolean(managerUpdate.resolutionNote.trim()));

  return (
    <PageLayout>
      <PageHeader
        eyebrow={t("complaints:eyebrow")}
        title={t("complaints:title")}
        description={role === "vendor" ? t("complaints:subtitleVendor") : t("complaints:subtitleManager")}
        actions={
          role === "vendor" ? (
            <Button onClick={() => setShowNew(true)} className="rounded-lg shadow-none bg-primary hover:bg-primary/90 font-bold">
              <Plus className="mr-1 h-4 w-4" />
              {t("complaints:newComplaint")}
            </Button>
          ) : undefined
        }
      />

      {/* Summary strip */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("complaints:openComplaints")} value={openCount} sublabel={openCount ? t("complaints:waitingTriage") : t("complaints:queueClear")} icon={openCount ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} />
        <StatCard label={t("complaints:inProgress")} value={inProgressCount} sublabel={t("complaints:underReview")} icon={<MessageSquare className="h-4 w-4" />} tone="blue" />
        <StatCard label={t("complaints:slaRisk")} value={breachedCount} sublabel={breachedCount ? t("complaints:overdueEscalated") : t("complaints:queueClear")} icon={<AlertTriangle className="h-4 w-4" />} tone="red" />
        <StatCard label={t("complaints:resolvedClosed")} value={resolvedCount} sublabel={t("complaints:completedLifecycle")} icon={<CheckCircle2 className="h-4 w-4" />} tone="green" />
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {/* Register table */}
      <DataTableFrame title={t("complaints:register")} actions={
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="border-slate-300 pl-9 rounded-lg focus-visible:border-primary focus-visible:ring-0 h-9" placeholder={t("complaints:searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={categoryFilter} onValueChange={(v: CategoryFilter) => setCategoryFilter(v)}>
            <SelectTrigger className="h-9 w-full border-slate-300 rounded-lg sm:w-[150px]"><SelectValue placeholder={t("complaints:category")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("complaints:allCategories")}</SelectItem>
              {Object.entries(categoryLabelKeys).map(([k, v]) => <SelectItem key={k} value={k}>{t(v)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v: StatusFilter) => setStatusFilter(v)}>
            <SelectTrigger className="h-9 w-full border-slate-300 rounded-lg sm:w-[130px]"><SelectValue placeholder={t("complaints:status")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("complaints:allStatus")}</SelectItem>
              <SelectItem value="open">{t("complaints:open")}</SelectItem>
              <SelectItem value="in_progress">{t("complaints:steps.inProgress")}</SelectItem>
              <SelectItem value="resolved">{t("complaints:resolved")}</SelectItem>
              <SelectItem value="closed">{t("complaints:closed")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={(v: PriorityFilter) => setPriorityFilter(v)}>
            <SelectTrigger className="h-9 w-full border-slate-300 rounded-lg sm:w-[130px]"><SelectValue placeholder={t("complaints:priority")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("complaints:allPriority")}</SelectItem>
              {Object.entries(priorityLabelKeys).map(([k, v]) => <SelectItem key={k} value={k}>{t(v)}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="hidden rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500 sm:inline-flex">{filteredTickets.length} / {tickets.length}</span>
          <Button variant="outline" size="sm" className="rounded-lg border-slate-300 h-9" onClick={() => { setSearch(""); setCategoryFilter("all"); setStatusFilter("all"); setPriorityFilter("all"); }}>
            <Filter className="mr-1 h-3.5 w-3.5" />{t("common:reset")}
          </Button>
        </div>
      }>
        {isPending ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ) : isError ? (
          <div className="p-6 text-center text-sm text-red-600">{t("complaints:loadError")}</div>
        ) : filteredTickets.length === 0 ? (
          <ConsoleEmptyState title={t("complaints:noComplaintsMatch")} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs font-bold text-slate-600">{t("complaints:ticket")}</TableHead>
                  {role !== "vendor" && <TableHead className="text-xs font-bold text-slate-600">{t("complaints:vendor")}</TableHead>}
                  <TableHead className="text-xs font-bold text-slate-600">{t("complaints:subject")}</TableHead>
                  <TableHead className="text-xs font-bold text-slate-600">{t("complaints:category")}</TableHead>
                  <TableHead className="text-xs font-bold text-slate-600">{t("complaints:priority")}</TableHead>
                  <TableHead className="text-xs font-bold text-slate-600">{t("complaints:status")}</TableHead>
                  <TableHead className="text-xs font-bold text-slate-600">{t("complaints:sla")}</TableHead>
                  <TableHead className="text-xs font-bold text-slate-600">{t("complaints:created")}</TableHead>
                  <TableHead className="text-right text-xs font-bold text-slate-600">{t("complaints:action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTickets.map((ticket) => (
                  <TableRow key={ticket.id} className="hover:bg-slate-50">
                    <TableCell className="whitespace-nowrap font-mono text-xs text-slate-700">{ticket.ticketNumber}</TableCell>
                    {role !== "vendor" && <TableCell className="whitespace-nowrap text-xs font-semibold text-slate-900">{ticket.vendorName}</TableCell>}
                    <TableCell className="min-w-[200px]">
                      <p className="truncate text-sm font-semibold text-slate-900">{ticket.subject}</p>
                    </TableCell>
                    <TableCell>
                      <span className="rounded-lg border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {t(categoryLabelKeys[ticket.category])}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`rounded-lg border px-2 py-0.5 text-xs font-semibold ${priorityClasses[ticket.priority]}`}>
                        {t(priorityLabelKeys[ticket.priority])}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={ticket.status} context="ticket" />
                    </TableCell>
                    <TableCell className={`whitespace-nowrap text-xs ${ticket.breachedSla ? "font-bold text-red-600" : "text-slate-500"}`}>
                      {formatSla(ticket, t)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-slate-500">{formatHumanDateTime(ticket.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" className="h-7 rounded-lg border-slate-300 px-2 text-xs font-bold"
                        onClick={() => { setSelected(ticket); setManagerUpdate({ status: ticket.status, resolutionNote: ticket.resolution || "", note: "", internal: false }); }}>
                        {t("common:view")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DataTableFrame>

      {/* New complaint dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-xl rounded-lg">
          <DialogHeader>
            <DialogTitle className="font-bold text-slate-900">{t("complaints:lodgeComplaint")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="complaint-category" className="font-bold text-slate-700">{t("complaints:category")}</Label>
              <Select value={newTicket.category} onValueChange={(v: TicketCategory) => setNewTicket((c) => ({ ...c, category: v }))}>
                <SelectTrigger id="complaint-category" className="border-slate-300 rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(categoryLabelKeys).map(([k, v]) => <SelectItem key={k} value={k}>{t(v)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="complaint-severity" className="font-bold text-slate-700">{t("complaints:severity")}</Label>
              <Select value={newTicket.priority} onValueChange={(v: TicketPriority) => setNewTicket((c) => ({ ...c, priority: v }))}>
                <SelectTrigger id="complaint-severity" className="border-slate-300 rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(priorityLabelKeys).map(([k, v]) => <SelectItem key={k} value={k}>{t(v)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="complaint-subject" className="font-bold text-slate-700">{t("complaints:subject")}</Label>
              <Input id="complaint-subject" className="border-slate-300 rounded-lg" value={newTicket.subject} onChange={(e) => setNewTicket((c) => ({ ...c, subject: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="complaint-description" className="font-bold text-slate-700">{t("complaints:description")}</Label>
                <span className={`text-xs ${newTicket.description.length < 20 ? "text-slate-400" : "text-emerald-600"}`}>{t("complaints:charCount", { n: newTicket.description.length })}</span>
              </div>
              <Textarea id="complaint-description" className="border-slate-300 rounded-lg" rows={4} value={newTicket.description} onChange={(e) => setNewTicket((c) => ({ ...c, description: e.target.value }))} placeholder={t("complaints:descPlaceholder")} />
              {newTicket.description.length > 0 && newTicket.description.length < 20 && (
                <p className="text-xs text-amber-600">{t("complaints:descHint")}</p>
              )}
            </div>
            <FileUploadCard id="complaint-attachment" label={t("complaints:attachment")} description={t("complaints:attachmentDesc")} accept=".pdf,.jpg,.jpeg,.png" value={newTicket.attachment?.name || t("common:noFileSelected")} onChange={(file) => setNewTicket((c) => ({ ...c, attachment: file }))} />
            <Button className="w-full rounded-lg shadow-none bg-primary hover:bg-primary/90 font-bold" onClick={() => createTicket.mutate()} disabled={createTicket.isPending || !canSubmit}>
              {createTicket.isPending ? t("common:submitting") : t("complaints:submitComplaint")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ticket detail dialog */}
      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-2xl rounded-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-bold text-slate-900">
              {selected ? t("complaints:ticketNumber", { ticketNumber: selected.ticketNumber, subject: selected.subject }) : t("complaints:ticketDetail")}
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 text-sm">
              {/* Meta rows */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 divide-y divide-slate-100">
                {[
                  { label: t("complaints:ticket"), value: <span className="font-mono text-xs font-bold">{selected.ticketNumber}</span> },
                  { label: t("complaints:vendor"), value: selected.vendorName },
                  { label: t("complaints:category"), value: t(categoryLabelKeys[selected.category]) },
                  { label: t("complaints:priority"), value: <span className={`rounded-lg border px-2 py-0.5 text-xs font-semibold ${priorityClasses[selected.priority]}`}>{t(priorityLabelKeys[selected.priority])}</span> },
                  { label: t("complaints:status"), value: <StatusBadge status={selected.status} context="ticket" /> },
                  { label: t("complaints:sla"), value: <span className={selected.breachedSla ? "font-bold text-red-600" : ""}>{formatSla(selected, t)}</span> },
                  ...(selected.assignedToName ? [{ label: t("complaints:assignedTo"), value: selected.assignedToName }] : []),
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <span className="text-slate-500">{row.label}</span>
                    <span className="font-semibold text-slate-900">{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Progress */}
              <ComplaintProgress status={selected.status} />

              {/* Description */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm text-slate-700">{selected.description}</p>
              </div>

              {/* Attachments */}
              {selected.attachments.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 font-bold text-slate-900">{t("complaints:attachments")}</p>
                  {selected.attachments.map((a) => <p key={a.id} className="text-sm text-slate-500">{a.name}</p>)}
                </div>
              )}

              {/* Timeline */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-3 font-bold text-slate-900">{t("complaints:timeline")}</p>
                <div className="space-y-3">
                  {buildTimeline(selected, t).map((event) => (
                    <div key={event.id} className="flex gap-3">
                      <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white">
                        {event.internal ? <Lock className="h-3 w-3 text-slate-400" /> : <MessageSquare className="h-3 w-3 text-slate-400" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">{event.label}</p>
                          {event.internal && <span className="rounded-lg bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-500">{t("complaints:internal")}</span>}
                          <span className="text-xs text-slate-400">{formatHumanDateTime(event.timestamp)}</span>
                        </div>
                        <p className="text-xs text-slate-500">{event.actor}</p>
                        <p className="mt-1 text-sm text-slate-600">{event.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Manager actions */}
              {role === "manager" ? (
                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="font-bold text-slate-900">{t("complaints:managerResponse")}</p>
                  <div className="space-y-1.5">
                    <Label htmlFor="ticket-update-status" className="font-bold text-slate-700">{t("complaints:updateStatus")}</Label>
                    <Select value={managerUpdate.status} onValueChange={(v: TicketStatus) => setManagerUpdate((c) => ({ ...c, status: v }))}>
                      <SelectTrigger id="ticket-update-status" className="border-slate-300 rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>{nextStatusOptions(selected.status).map((o) => <SelectItem key={o.value} value={o.value}>{t(o.labelKey)}</SelectItem>)}</SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500">{t("complaints:statusAuditNote")}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ticket-resolution-note" className="font-bold text-slate-700">{t("complaints:resolutionNote")}</Label>
                    <Textarea id="ticket-resolution-note" className="border-slate-300 rounded-lg" rows={3} value={managerUpdate.resolutionNote} onChange={(e) => setManagerUpdate((c) => ({ ...c, resolutionNote: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ticket-staff-note" className="font-bold text-slate-700">{t("complaints:staffNote")}</Label>
                    <Textarea id="ticket-staff-note" className="border-slate-300 rounded-lg" rows={2} value={managerUpdate.note} onChange={(e) => setManagerUpdate((c) => ({ ...c, note: e.target.value }))} />
                  </div>
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={managerUpdate.internal} onChange={(e) => setManagerUpdate((c) => ({ ...c, internal: e.target.checked }))} className="h-4 w-4 rounded border-slate-300" />
                    <span className="font-medium text-slate-700">{t("complaints:markInternal")}</span>
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button className="flex-1 rounded-lg shadow-none bg-emerald-600 hover:bg-emerald-700 font-bold" onClick={() => updateTicket.mutate()} disabled={updateTicket.isPending || !canUpdate}>
                      {t("complaints:updateTicket")}
                    </Button>
                    <Button type="button" variant="outline" className="flex-1 rounded-lg border-slate-300 font-bold" onClick={() => escalateTicket.mutate()} disabled={escalateTicket.isPending || selected.status === "closed"}>
                      <ArrowUpRight className="mr-1 h-4 w-4" />
                      {t("complaints:escalate")}
                    </Button>
                  </div>
                </div>
              ) : (
                selected.resolution && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <p className="font-bold text-emerald-800">{t("complaints:resolution")}</p>
                    <p className="mt-1 text-sm text-emerald-700">{selected.resolution}</p>
                  </div>
                )
              )}

              {/* Badge summary footer */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <StatusBadge status={selected.status} context="ticket" />
                <Badge variant={selected.priority === "urgent" || selected.priority === "high" ? "error" : selected.priority === "medium" ? "warning" : "secondary"}>
                  {t(priorityLabelKeys[selected.priority])}
                </Badge>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
};

export default ComplaintsPage;
