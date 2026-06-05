import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
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
import { FileUploadCard } from "@/components/console/ConsolePage";
import { MockupHeader, MockupPage, MockupPanel, StatusPill } from "@/components/mockup/MockupUI";
import type { Ticket, TicketCategory, TicketPriority, TicketStatus } from "@/types";

// ─── Types ───────────────────────────────────────────────
type StatusFilter = "all" | TicketStatus;
type CategoryFilter = "all" | TicketCategory;
type PriorityFilter = "all" | TicketPriority;

// ─── Constants ───────────────────────────────────────────
const categoryLabels: Record<TicketCategory, string> = {
  billing: "Billing", maintenance: "Maintenance", dispute: "Dispute",
  payment: "Payment", stall: "Stall", sanitation: "Sanitation",
  harassment: "Harassment", other: "Other",
};

const priorityLabels: Record<TicketPriority, string> = {
  low: "Low", medium: "Medium", high: "High", urgent: "Urgent",
};

const priorityClasses: Record<TicketPriority, string> = {
  urgent: "border-red-200 bg-red-50 text-red-700",
  high: "border-red-200 bg-red-50 text-red-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-slate-200 bg-slate-50 text-slate-600",
};

const statusClasses: Record<TicketStatus, string> = {
  open: "border-amber-200 bg-amber-50 text-amber-700",
  in_progress: "border-blue-200 bg-blue-50 text-blue-700",
  resolved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  closed: "border-slate-200 bg-slate-50 text-slate-500",
};

const statusLabels: Record<TicketStatus, string> = {
  open: "Open", in_progress: "In Progress", resolved: "Resolved", closed: "Closed",
};

const complaintSteps = ["Submitted", "In Progress", "Resolved", "Closed"];

const getStepIndex = (status: TicketStatus) => {
  if (status === "closed") return 3;
  if (status === "resolved") return 2;
  if (status === "in_progress") return 1;
  return 0;
};

const formatSla = (ticket: Ticket) => {
  if (!ticket.slaDueAt) return "No SLA";
  if (ticket.status === "resolved" || ticket.status === "closed") return "Completed";
  const diff = new Date(ticket.slaDueAt).getTime() - Date.now();
  const absHours = Math.ceil(Math.abs(diff) / (1000 * 60 * 60));
  if (diff < 0) return `${absHours}h overdue`;
  if (absHours < 24) return `${absHours}h left`;
  return `${Math.ceil(absHours / 24)}d left`;
};

const buildTimeline = (ticket: Ticket) => [
  { id: `${ticket.id}-created`, label: "Ticket Created", detail: `${ticket.ticketNumber} submitted by ${ticket.vendorName}.`, actor: ticket.vendorName, timestamp: ticket.createdAt, internal: false },
  ...ticket.updates.map((u) => ({ id: u.id, label: u.internal ? "Internal Note" : u.status === ticket.status ? "Update" : "Status Change", detail: u.note, actor: u.actorName, timestamp: u.createdAt, internal: u.internal })),
  ...(ticket.escalatedAt ? [{ id: `${ticket.id}-esc`, label: "Escalated", detail: ticket.escalationReason || "Senior review required.", actor: ticket.assignedToName || "System", timestamp: ticket.escalatedAt, internal: true }] : []),
  ...(ticket.resolvedAt ? [{ id: `${ticket.id}-res`, label: "Resolved", detail: ticket.resolutionReference || `${ticket.ticketNumber}-RES`, actor: ticket.assignedToName || "Manager", timestamp: ticket.resolvedAt, internal: false }] : []),
].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

const nextStatusOptions = (status: TicketStatus): Array<{ value: TicketStatus; label: string }> => {
  const all: Array<{ value: TicketStatus; label: string }> = [
    { value: "open", label: "Open" }, { value: "in_progress", label: "In Progress" },
    { value: "resolved", label: "Resolved" }, { value: "closed", label: "Closed" },
  ];
  if (status === "open") return all.filter((o) => ["open", "in_progress", "closed"].includes(o.value));
  if (status === "in_progress") return all.filter((o) => ["in_progress", "resolved", "closed"].includes(o.value));
  if (status === "resolved") return all.filter((o) => ["resolved", "closed"].includes(o.value));
  return all.filter((o) => o.value === "closed");
};

// ─── Sub-components ───────────────────────────────────────
const ComplaintProgress = ({ status }: { status: TicketStatus }) => {
  const active = getStepIndex(status);
  return (
    <div className="space-y-2">
      <div className="relative h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${(active / (complaintSteps.length - 1)) * 100}%` }} />
      </div>
      <div className="grid grid-cols-4 gap-1 text-[11px] font-medium">
        {complaintSteps.map((step, i) => (
          <span key={step} className={`inline-flex items-center gap-1 ${i <= active ? "text-slate-900" : "text-slate-400"}`}>
            {i <= active && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
            {step}
          </span>
        ))}
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────
const ComplaintsPage = () => {
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
      toast.success("Complaint submitted", { description: "A trackable ticket number has been created." });
    },
    onError: (e) => { const msg = e instanceof ApiError ? e.message : "Unable to create ticket."; setError(msg); toast.error("Complaint was not submitted", { description: msg }); },
  });

  const updateTicket = useMutation({
    mutationFn: () => api.updateTicket(selected!.ticketNumber, managerUpdate),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setSelected(null); setError(null);
      toast.success("Ticket updated");
    },
    onError: (e) => { const msg = e instanceof ApiError ? e.message : "Unable to update ticket."; setError(msg); toast.error("Ticket was not updated", { description: msg }); },
  });

  const escalateTicket = useMutation({
    mutationFn: () => api.escalateTicket(selected!.ticketNumber, managerUpdate.note.trim() || "SLA or operational risk requires official review."),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setSelected(null); setError(null);
      toast.success("Ticket escalated");
    },
    onError: (e) => { const msg = e instanceof ApiError ? e.message : "Unable to escalate ticket."; setError(msg); toast.error("Ticket was not escalated", { description: msg }); },
  });

  const tickets = data?.tickets || [];

  const filteredTickets = tickets.filter((ticket) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || [ticket.ticketNumber, ticket.subject, ticket.description, ticket.vendorName || "", categoryLabels[ticket.category], ticket.status, ticket.priority].join(" ").toLowerCase().includes(term);
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
    <MockupPage>
      <MockupHeader
        eyebrow="Ticket desk"
        title="Grievances & Appeals"
        subtitle={role === "vendor" ? "Submit and track market complaints." : "Review and resolve vendor disputes."}
        actions={
          role === "vendor" ? (
            <Button onClick={() => setShowNew(true)} className="rounded-sm shadow-none bg-primary hover:bg-primary/90 font-bold">
              <Plus className="mr-1 h-4 w-4" />
              New Complaint
            </Button>
          ) : undefined
        }
      />

      {/* Summary strip */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Open complaints", value: openCount, sub: openCount ? "Waiting for triage" : "Queue clear", tone: openCount ? "amber" as const : "green" as const },
          { label: "In progress", value: inProgressCount, sub: "Assigned or under review", tone: "blue" as const },
          { label: "SLA risk", value: breachedCount, sub: "Overdue or escalated", tone: breachedCount ? "red" as const : "green" as const },
          { label: "Resolved / closed", value: resolvedCount, sub: "Completed lifecycle", tone: "green" as const },
        ].map((item) => (
          <div key={item.label} className="rounded-sm border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-600">{item.label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-950 font-heading">{item.value}</p>
            <p className="mt-1 text-xs text-slate-500">{item.sub}</p>
          </div>
        ))}
      </div>

      {error && <div className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {/* Register table */}
      <MockupPanel
        title="Complaints Register"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="border-slate-300 pl-9 rounded-sm focus-visible:border-primary focus-visible:ring-0 h-9" placeholder="Search ticket, vendor, subject..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={categoryFilter} onValueChange={(v: CategoryFilter) => setCategoryFilter(v)}>
              <SelectTrigger className="h-9 w-full border-slate-300 rounded-sm sm:w-[150px]"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(categoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v: StatusFilter) => setStatusFilter(v)}>
              <SelectTrigger className="h-9 w-full border-slate-300 rounded-sm sm:w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={(v: PriorityFilter) => setPriorityFilter(v)}>
              <SelectTrigger className="h-9 w-full border-slate-300 rounded-sm sm:w-[130px]"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                {Object.entries(priorityLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="hidden rounded-sm border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500 sm:inline-flex">{filteredTickets.length} / {tickets.length}</span>
            <Button variant="outline" size="sm" className="rounded-sm border-slate-300 h-9" onClick={() => { setSearch(""); setCategoryFilter("all"); setStatusFilter("all"); setPriorityFilter("all"); }}>
              <Filter className="mr-1 h-3.5 w-3.5" />Reset
            </Button>
          </div>
        }
      >
        {isPending ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full rounded-sm" />
            <Skeleton className="h-10 w-full rounded-sm" />
            <Skeleton className="h-10 w-full rounded-sm" />
          </div>
        ) : isError ? (
          <div className="p-6 text-center text-sm text-red-600">Unable to load complaints. Please check your connection.</div>
        ) : filteredTickets.length === 0 ? (
          <div className="rounded-sm border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-400">
            No complaints match the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs font-bold text-slate-600">Ticket</TableHead>
                  {role !== "vendor" && <TableHead className="text-xs font-bold text-slate-600">Vendor</TableHead>}
                  <TableHead className="text-xs font-bold text-slate-600">Subject</TableHead>
                  <TableHead className="text-xs font-bold text-slate-600">Category</TableHead>
                  <TableHead className="text-xs font-bold text-slate-600">Priority</TableHead>
                  <TableHead className="text-xs font-bold text-slate-600">Status</TableHead>
                  <TableHead className="text-xs font-bold text-slate-600">SLA</TableHead>
                  <TableHead className="text-xs font-bold text-slate-600">Created</TableHead>
                  <TableHead className="text-right text-xs font-bold text-slate-600">Action</TableHead>
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
                      <span className="rounded-sm border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {categoryLabels[ticket.category]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`rounded-sm border px-2 py-0.5 text-xs font-semibold ${priorityClasses[ticket.priority]}`}>
                        {priorityLabels[ticket.priority]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`rounded-sm border px-2 py-0.5 text-xs font-semibold ${statusClasses[ticket.status]}`}>
                        {statusLabels[ticket.status]}
                      </span>
                    </TableCell>
                    <TableCell className={`whitespace-nowrap text-xs ${ticket.breachedSla ? "font-bold text-red-600" : "text-slate-500"}`}>
                      {formatSla(ticket)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-slate-500">{formatHumanDateTime(ticket.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" className="h-7 rounded-sm border-slate-300 px-2 text-xs font-bold"
                        onClick={() => { setSelected(ticket); setManagerUpdate({ status: ticket.status, resolutionNote: ticket.resolution || "", note: "", internal: false }); }}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </MockupPanel>

      {/* New complaint dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-xl rounded-sm">
          <DialogHeader>
            <DialogTitle className="font-bold text-slate-900">Lodge a Complaint</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="font-bold text-slate-700">Category</Label>
              <Select value={newTicket.category} onValueChange={(v: TicketCategory) => setNewTicket((c) => ({ ...c, category: v }))}>
                <SelectTrigger className="border-slate-300 rounded-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(categoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold text-slate-700">Severity</Label>
              <Select value={newTicket.priority} onValueChange={(v: TicketPriority) => setNewTicket((c) => ({ ...c, priority: v }))}>
                <SelectTrigger className="border-slate-300 rounded-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(priorityLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold text-slate-700">Subject</Label>
              <Input className="border-slate-300 rounded-sm" value={newTicket.subject} onChange={(e) => setNewTicket((c) => ({ ...c, subject: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="font-bold text-slate-700">Description</Label>
                <span className={`text-xs ${newTicket.description.length < 20 ? "text-slate-400" : "text-emerald-600"}`}>{newTicket.description.length} / 20 min</span>
              </div>
              <Textarea className="border-slate-300 rounded-sm" rows={4} value={newTicket.description} onChange={(e) => setNewTicket((c) => ({ ...c, description: e.target.value }))} placeholder="Describe the issue clearly — include location, what happened, and when." />
              {newTicket.description.length > 0 && newTicket.description.length < 20 && (
                <p className="text-xs text-amber-600">Please add more detail so the manager can understand the issue.</p>
              )}
            </div>
            <FileUploadCard id="complaint-attachment" label="Attachment (optional)" description="Add a photo or document if it helps resolve the case." accept=".pdf,.jpg,.jpeg,.png" value={newTicket.attachment?.name || "No file selected"} onChange={(file) => setNewTicket((c) => ({ ...c, attachment: file }))} />
            <Button className="w-full rounded-sm shadow-none bg-primary hover:bg-primary/90 font-bold" onClick={() => createTicket.mutate()} disabled={createTicket.isPending || !canSubmit}>
              {createTicket.isPending ? "Submitting..." : "Submit Complaint"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ticket detail dialog */}
      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-2xl rounded-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-bold text-slate-900">
              {selected ? `${selected.ticketNumber} — ${selected.subject}` : "Ticket Detail"}
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 text-sm">
              {/* Meta rows */}
              <div className="rounded-sm border border-slate-200 bg-slate-50 divide-y divide-slate-100">
                {[
                  { label: "Reference", value: <span className="font-mono text-xs font-bold">{selected.ticketNumber}</span> },
                  { label: "Vendor", value: selected.vendorName },
                  { label: "Category", value: categoryLabels[selected.category] },
                  { label: "Priority", value: <span className={`rounded-sm border px-2 py-0.5 text-xs font-semibold ${priorityClasses[selected.priority]}`}>{priorityLabels[selected.priority]}</span> },
                  { label: "Status", value: <span className={`rounded-sm border px-2 py-0.5 text-xs font-semibold ${statusClasses[selected.status]}`}>{statusLabels[selected.status]}</span> },
                  { label: "SLA", value: <span className={selected.breachedSla ? "font-bold text-red-600" : ""}>{formatSla(selected)}</span> },
                  ...(selected.assignedToName ? [{ label: "Assigned To", value: selected.assignedToName }] : []),
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
              <div className="rounded-sm border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm text-slate-700">{selected.description}</p>
              </div>

              {/* Attachments */}
              {selected.attachments.length > 0 && (
                <div className="rounded-sm border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 font-bold text-slate-900">Attachments</p>
                  {selected.attachments.map((a) => <p key={a.id} className="text-sm text-slate-500">{a.name}</p>)}
                </div>
              )}

              {/* Timeline */}
              <div className="rounded-sm border border-slate-200 bg-slate-50 p-3">
                <p className="mb-3 font-bold text-slate-900">Timeline</p>
                <div className="space-y-3">
                  {buildTimeline(selected).map((event) => (
                    <div key={event.id} className="flex gap-3">
                      <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white">
                        {event.internal ? <Lock className="h-3 w-3 text-slate-400" /> : <MessageSquare className="h-3 w-3 text-slate-400" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">{event.label}</p>
                          {event.internal && <span className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-500">Internal</span>}
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
                <div className="space-y-3 rounded-sm border border-slate-200 bg-slate-50 p-4">
                  <p className="font-bold text-slate-900">Manager Response</p>
                  <div className="space-y-1.5">
                    <Label className="font-bold text-slate-700">Update Status</Label>
                    <Select value={managerUpdate.status} onValueChange={(v: TicketStatus) => setManagerUpdate((c) => ({ ...c, status: v }))}>
                      <SelectTrigger className="border-slate-300 rounded-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{nextStatusOptions(selected.status).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500">Status changes are written to the audit log.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-bold text-slate-700">Resolution / Closure Note</Label>
                    <Textarea className="border-slate-300 rounded-sm" rows={3} value={managerUpdate.resolutionNote} onChange={(e) => setManagerUpdate((c) => ({ ...c, resolutionNote: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-bold text-slate-700">Staff Note</Label>
                    <Textarea className="border-slate-300 rounded-sm" rows={2} value={managerUpdate.note} onChange={(e) => setManagerUpdate((c) => ({ ...c, note: e.target.value }))} />
                  </div>
                  <label className="flex items-center gap-2 rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={managerUpdate.internal} onChange={(e) => setManagerUpdate((c) => ({ ...c, internal: e.target.checked }))} className="h-4 w-4 rounded border-slate-300" />
                    <span className="font-medium text-slate-700">Mark note as internal</span>
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button className="flex-1 rounded-sm shadow-none bg-emerald-600 hover:bg-emerald-700 font-bold" onClick={() => updateTicket.mutate()} disabled={updateTicket.isPending || !canUpdate}>
                      Update Ticket
                    </Button>
                    <Button type="button" variant="outline" className="flex-1 rounded-sm border-slate-300 font-bold" onClick={() => escalateTicket.mutate()} disabled={escalateTicket.isPending || selected.status === "closed"}>
                      <ArrowUpRight className="mr-1 h-4 w-4" />
                      Escalate
                    </Button>
                  </div>
                </div>
              ) : (
                selected.resolution && (
                  <div className="rounded-sm border border-emerald-200 bg-emerald-50 p-3">
                    <p className="font-bold text-emerald-800">Resolution</p>
                    <p className="mt-1 text-sm text-emerald-700">{selected.resolution}</p>
                  </div>
                )
              )}

              {/* StatusPill summary footer */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <StatusPill tone={selected.status === "resolved" || selected.status === "closed" ? "green" : selected.status === "in_progress" ? "blue" : "amber"}>
                  {statusLabels[selected.status]}
                </StatusPill>
                <StatusPill tone={selected.priority === "urgent" || selected.priority === "high" ? "red" : selected.priority === "medium" ? "amber" : "slate"}>
                  {priorityLabels[selected.priority]}
                </StatusPill>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MockupPage>
  );
};

export default ComplaintsPage;
