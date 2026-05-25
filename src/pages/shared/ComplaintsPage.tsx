import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
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
import {
  ConsolePage,
  DataTableFrame,
  EmptyState,
  FileUploadCard,
  PageHeader,
} from "@/components/console/ConsolePage";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Ticket, TicketCategory, TicketPriority, TicketStatus } from "@/types";

type StatusFilter = "all" | TicketStatus;
type CategoryFilter = "all" | TicketCategory;
type PriorityFilter = "all" | TicketPriority;

const categoryLabels: Record<TicketCategory, string> = {
  billing: "Billing",
  maintenance: "Maintenance",
  dispute: "Dispute",
  payment: "Payment",
  stall: "Stall",
  sanitation: "Sanitation",
  harassment: "Harassment",
  other: "Other",
};

const priorityLabels: Record<TicketPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const complaintSteps = ["Submitted", "In Progress", "Resolved", "Closed"];

const getComplaintStepIndex = (status: TicketStatus) => {
  if (status === "closed") return 3;
  if (status === "resolved") return 2;
  if (status === "in_progress") return 1;
  return 0;
};

const getComplaintStatusLabel = (status: TicketStatus) =>
  status === "open" ? "Open" : undefined;

const priorityToneClasses: Record<TicketPriority, string> = {
  urgent: "border-destructive/30 bg-destructive/10 text-destructive",
  high: "border-destructive/20 bg-destructive/10 text-destructive",
  medium: "border-warning/20 bg-warning/10 text-warning-foreground",
  low: "border-border bg-muted text-muted-foreground",
};

const ticketStatusOptions: Array<{ value: TicketStatus; label: string }> = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const nextTicketStatusOptions = (status: TicketStatus) => {
  if (status === "open") return ticketStatusOptions.filter((option) => ["open", "in_progress", "closed"].includes(option.value));
  if (status === "in_progress") return ticketStatusOptions.filter((option) => ["in_progress", "resolved", "closed"].includes(option.value));
  if (status === "resolved") return ticketStatusOptions.filter((option) => ["resolved", "closed"].includes(option.value));
  return ticketStatusOptions.filter((option) => option.value === "closed");
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

const buildTicketTimeline = (ticket: Ticket) => {
  const events = [
    {
      id: `${ticket.id}-created`,
      label: "Ticket Created",
      detail: `${ticket.ticketNumber} was submitted by ${ticket.vendorName}.`,
      actor: ticket.vendorName,
      timestamp: ticket.createdAt,
      internal: false,
    },
    ...ticket.updates.map((update) => ({
      id: update.id,
      label: update.internal ? "Internal Note Added" : update.status === ticket.status ? "Ticket Update" : "Status Update",
      detail: update.note,
      actor: update.actorName,
      timestamp: update.createdAt,
      internal: update.internal,
    })),
    ...(ticket.escalatedAt
      ? [
          {
            id: `${ticket.id}-escalated`,
            label: "Escalated",
            detail: `${ticket.escalationReference || `${ticket.ticketNumber}-ESC`}: ${ticket.escalationReason || "Senior review required."}`,
            actor: ticket.assignedToName || "System",
            timestamp: ticket.escalatedAt,
            internal: true,
          },
        ]
      : []),
    ...(ticket.resolvedAt
      ? [
          {
            id: `${ticket.id}-resolved`,
            label: "Resolved",
            detail: ticket.resolutionReference || `${ticket.ticketNumber}-RES`,
            actor: ticket.assignedToName || "Manager",
            timestamp: ticket.resolvedAt,
            internal: false,
          },
        ]
      : []),
  ];

  return events.sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
};

const ComplaintProgress = ({ status }: { status: TicketStatus }) => {
  const activeIndex = getComplaintStepIndex(status);

  return (
    <div className="space-y-2">
      <Progress value={(activeIndex / (complaintSteps.length - 1)) * 100} className="h-2" />
      <div className="grid grid-cols-4 gap-2 text-[11px] font-medium">
        {complaintSteps.map((step, index) => (
          <div
            key={step}
            className={index <= activeIndex ? "text-foreground" : "text-muted-foreground"}
          >
            <span className="inline-flex items-center gap-1">
              {index <= activeIndex && <CheckCircle2 className="h-3 w-3 text-success" />}
              {step}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

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
    category: TicketCategory;
    priority: TicketPriority;
    subject: string;
    description: string;
    attachment: File | null;
  }>({
    category: "maintenance",
    priority: "medium",
    subject: "",
    description: "",
    attachment: null,
  });

  const [managerUpdate, setManagerUpdate] = useState<{
    status: TicketStatus;
    resolutionNote: string;
    note: string;
    internal: boolean;
  }>({
    status: "in_progress",
    resolutionNote: "",
    note: "",
    internal: false,
  });

  const { data, isPending, isError } = useQuery({
    queryKey: ["tickets"],
    queryFn: () => api.getTickets(),
  });

  const createTicket = useMutation({
    mutationFn: () => api.createTicket(newTicket),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setShowNew(false);
      setNewTicket({
        category: "maintenance",
        priority: "medium",
        subject: "",
        description: "",
        attachment: null,
      });
      setError(null);
      toast.success("Complaint submitted", {
        description: "A trackable ticket number has been created in the complaint register.",
      });
    },
    onError: (mutationError) => {
      const message =
        mutationError instanceof ApiError ? mutationError.message : "Unable to create ticket.";
      setError(message);
      toast.error("Complaint was not submitted", { description: message });
    },
  });

  const updateTicket = useMutation({
    mutationFn: () => api.updateTicket(selected!.ticketNumber, managerUpdate),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setSelected(null);
      setError(null);
      toast.success("Ticket updated");
    },
    onError: (mutationError) => {
      const message =
        mutationError instanceof ApiError ? mutationError.message : "Unable to update ticket.";
      setError(message);
      toast.error("Ticket was not updated", { description: message });
    },
  });

  const escalateTicket = useMutation({
    mutationFn: () =>
      api.escalateTicket(
        selected!.ticketNumber,
        managerUpdate.note.trim() || "SLA or operational risk requires official review.",
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setSelected(null);
      setError(null);
      toast.success("Ticket escalated");
    },
    onError: (mutationError) => {
      const message =
        mutationError instanceof ApiError ? mutationError.message : "Unable to escalate ticket.";
      setError(message);
      toast.error("Ticket was not escalated", { description: message });
    },
  });

  const tickets = data?.tickets || [];

  const filteredTickets = tickets.filter((ticket) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      [
        ticket.ticketNumber,
        ticket.id,
        ticket.subject,
        ticket.description,
        ticket.vendorName,
        categoryLabels[ticket.category],
        ticket.status,
        ticket.priority,
        ticket.assignedToName || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);

    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || ticket.category === categoryFilter;
    const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesCategory && matchesPriority;
  });

  const canSubmitComplaint = Boolean(
    newTicket.category &&
      newTicket.subject.trim() &&
      newTicket.description.trim().length >= 20,
  );
  const requiresResolution = managerUpdate.status === "resolved" || managerUpdate.status === "closed";
  const canUpdateSelectedTicket = Boolean(selected) && (!requiresResolution || Boolean(managerUpdate.resolutionNote.trim()));

  return (
    <ConsolePage>
      <PageHeader
        eyebrow="Ticket desk"
        title="Complaints"
        description={role === "vendor" ? "Submit and track market complaints." : "Review and resolve vendor disputes."}
        actions={
          role === "vendor" && (
            <Button onClick={() => setShowNew(true)} className="w-full sm:w-auto">
              <Plus className="mr-1 h-4 w-4" />
              New Complaint
            </Button>
          )
        }
      />

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {isError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading complaints</AlertTitle>
          <AlertDescription>
            We couldn&apos;t reach the server. Please check your connection.
          </AlertDescription>
        </Alert>
      ) : isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-[90px] w-full rounded-xl" />
          <Skeleton className="h-[90px] w-full rounded-xl" />
          <Skeleton className="h-[320px] w-full rounded-xl" />
        </div>
      ) : (
        <>
          <DataTableFrame
            className="workspace-primary-frame"
            title="Complaints Register"
            description="Queue for complaint handling."
            actions={
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                  <div className="relative w-full sm:w-[240px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Search TKT number, vendor, subject..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>

                  <Select value={categoryFilter} onValueChange={(value: CategoryFilter) => setCategoryFilter(value)}>
                    <SelectTrigger className="w-full sm:w-[160px]">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {Object.entries(categoryLabels).map(([key, value]) => (
                        <SelectItem key={key} value={key}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={(value: StatusFilter) => setStatusFilter(value)}>
                    <SelectTrigger className="w-full sm:w-[150px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="open">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={priorityFilter} onValueChange={(value: PriorityFilter) => setPriorityFilter(value)}>
                    <SelectTrigger className="w-full sm:w-[140px]">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priority</SelectItem>
                      {Object.entries(priorityLabels).map(([key, value]) => (
                        <SelectItem key={key} value={key}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <span className="inline-flex h-9 items-center rounded-md border border-border/70 bg-background px-3 text-xs text-muted-foreground">
                    {filteredTickets.length} / {tickets.length}
                  </span>

                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      setSearch("");
                      setCategoryFilter("all");
                      setStatusFilter("all");
                      setPriorityFilter("all");
                    }}
                  >
                    <Filter className="mr-1 h-4 w-4" />
                    Reset
                  </Button>
                </div>
            }
          >
              {filteredTickets.length === 0 ? (
                <div className="p-3">
                  <EmptyState
                    title="No complaints match this view"
                    description="Clear the filters or search by ticket, vendor, category, or status."
                  />
                </div>
              ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="text-xs">Ticket</TableHead>
                        {role !== "vendor" && <TableHead className="text-xs">Vendor</TableHead>}
                        <TableHead className="text-xs">Subject</TableHead>
                        <TableHead className="text-xs">Category</TableHead>
                        <TableHead className="text-xs">Priority</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">SLA</TableHead>
                        <TableHead className="text-xs">Created</TableHead>
                        <TableHead className="text-right text-xs">Action</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {filteredTickets.map((ticket) => {
                        return (
                          <TableRow key={ticket.id} className="text-xs">
                            <TableCell className="whitespace-nowrap font-mono text-xs">{ticket.ticketNumber}</TableCell>

                            {role !== "vendor" && (
                              <TableCell className="whitespace-nowrap text-xs font-medium">
                                {ticket.vendorName}
                              </TableCell>
                            )}

                            <TableCell className="min-w-[220px]">
                              <p className="truncate text-sm font-medium">{ticket.subject}</p>
                            </TableCell>

                            <TableCell>
                              <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">
                                {categoryLabels[ticket.category]}
                              </span>
                            </TableCell>

                            <TableCell>
                              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${priorityToneClasses[ticket.priority]}`}>
                                {priorityLabels[ticket.priority]}
                              </span>
                            </TableCell>

                            <TableCell>
                              <StatusBadge
                                status={ticket.status}
                                label={getComplaintStatusLabel(ticket.status)}
                              />
                            </TableCell>

                            <TableCell className={ticket.breachedSla ? "whitespace-nowrap text-xs font-medium text-destructive" : "whitespace-nowrap text-xs text-muted-foreground"}>
                              {formatSla(ticket)}
                            </TableCell>

                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {formatHumanDateTime(ticket.createdAt)}
                            </TableCell>

                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelected(ticket);
                                  setManagerUpdate({
                                    status: ticket.status,
                                    resolutionNote: ticket.resolution || "",
                                    note: "",
                                    internal: false,
                                  });
                                }}
                              >
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
              )}
          </DataTableFrame>
        </>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-heading">Lodge a Complaint</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="complaint-category">Category</Label>
              <Select
                value={newTicket.category}
                onValueChange={(value: TicketCategory) =>
                  setNewTicket((current) => ({ ...current, category: value }))
                }
              >
                <SelectTrigger id="complaint-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([key, value]) => (
                    <SelectItem key={key} value={key}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="complaint-priority">Severity</Label>
              <Select
                value={newTicket.priority}
                onValueChange={(value: TicketPriority) =>
                  setNewTicket((current) => ({ ...current, priority: value }))
                }
              >
                <SelectTrigger id="complaint-priority">
                  <SelectValue placeholder="Select severity" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(priorityLabels).map(([key, value]) => (
                    <SelectItem key={key} value={key}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="complaint-subject">Subject</Label>
              <Input
                id="complaint-subject"
                value={newTicket.subject}
                onChange={(event) =>
                  setNewTicket((current) => ({ ...current, subject: event.target.value }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="complaint-description">Description</Label>
                <span className={`text-xs ${newTicket.description.length < 20 ? "text-muted-foreground" : "text-success"}`}>
                  {newTicket.description.length} / 20 min
                </span>
              </div>
              <Textarea
                id="complaint-description"
                value={newTicket.description}
                onChange={(event) =>
                  setNewTicket((current) => ({ ...current, description: event.target.value }))
                }
                rows={4}
                placeholder="Describe the issue clearly — include the location, what happened, and when. The more detail you provide, the faster the manager can act."
              />
              {newTicket.description.length > 0 && newTicket.description.length < 20 && (
                <p className="text-xs text-warning">Please add a bit more detail so the manager can understand the issue.</p>
              )}
            </div>

            <FileUploadCard
              id="complaint-attachment"
              label="Attachment (optional)"
              description="Add a photo or document if it helps the manager resolve the case."
              accept=".pdf,.jpg,.jpeg,.png"
              value={newTicket.attachment?.name || "No file selected"}
              onChange={(file) => setNewTicket((current) => ({ ...current, attachment: file }))}
            />

            <Button
              className="w-full"
              onClick={() => createTicket.mutate()}
              disabled={createTicket.isPending || !canSubmitComplaint}
            >
              {createTicket.isPending ? "Submitting Complaint..." : "Submit Complaint"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {selected ? `${selected.ticketNumber} - ${selected.subject}` : "Ticket Detail"}
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reference</span>
                  <span className="font-mono text-xs font-semibold">{selected.ticketNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vendor</span>
                  <span className="font-medium">{selected.vendorName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Category</span>
                  <span>{categoryLabels[selected.category]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Priority</span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${priorityToneClasses[selected.priority]}`}>
                    {priorityLabels[selected.priority]}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge
                    status={selected.status}
                    label={getComplaintStatusLabel(selected.status)}
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SLA</span>
                  <span className={selected.breachedSla ? "font-medium text-destructive" : ""}>
                    {formatSla(selected)}
                  </span>
                </div>
                {selected.assignedToName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Assigned To</span>
                    <span>{selected.assignedToName}</span>
                  </div>
                )}
              </div>

              <ComplaintProgress status={selected.status} />

              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm">{selected.description}</p>
              </div>

              {selected.attachments.length > 0 && (
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <p className="mb-2 font-medium">Attachments</p>
                  {selected.attachments.map((attachment) => (
                    <p key={attachment.id} className="text-muted-foreground">
                      {attachment.name}
                    </p>
                  ))}
                </div>
              )}

              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="mb-2 font-medium">Timeline</p>
                <div className="space-y-3">
                  {buildTicketTimeline(selected).map((event) => (
                    <div key={event.id} className="flex gap-3">
                      <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-background">
                        {event.internal ? <Lock className="h-3 w-3 text-muted-foreground" /> : <MessageSquare className="h-3 w-3 text-muted-foreground" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{event.label}</p>
                          {event.internal && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                              Internal
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">{formatHumanDateTime(event.timestamp)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{event.actor}</p>
                        <p className="mt-1 text-muted-foreground">{event.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {role === "manager" ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="ticket-status">Update Status</Label>
                    <Select
                      value={managerUpdate.status}
                      onValueChange={(value: TicketStatus) =>
                        setManagerUpdate((current) => ({ ...current, status: value }))
                      }
                    >
                      <SelectTrigger id="ticket-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {nextTicketStatusOptions(selected.status).map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Lifecycle changes are written to the audit log and linked to this ticket reference.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ticket-resolution-note">Resolution / Closure Note</Label>
                    <Textarea
                      id="ticket-resolution-note"
                      value={managerUpdate.resolutionNote}
                      onChange={(event) =>
                        setManagerUpdate((current) => ({
                          ...current,
                          resolutionNote: event.target.value,
                        }))
                      }
                      rows={3}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ticket-manager-note">Staff Note</Label>
                    <Textarea
                      id="ticket-manager-note"
                      value={managerUpdate.note}
                      onChange={(event) =>
                        setManagerUpdate((current) => ({ ...current, note: event.target.value }))
                      }
                      rows={2}
                    />
                  </div>

                  <label className="flex items-center gap-2 rounded-md border border-border/70 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={managerUpdate.internal}
                      onChange={(event) =>
                        setManagerUpdate((current) => ({ ...current, internal: event.target.checked }))
                      }
                      className="h-4 w-4 rounded border-border"
                    />
                    <span>Mark note as internal</span>
                  </label>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      className="flex-1"
                      onClick={() => updateTicket.mutate()}
                      disabled={updateTicket.isPending || !canUpdateSelectedTicket}
                    >
                      Update Ticket
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => escalateTicket.mutate()}
                      disabled={escalateTicket.isPending || selected.status === "closed"}
                    >
                      <ArrowUpRight className="mr-1 h-4 w-4" />
                      Escalate
                    </Button>
                  </div>
                </>
              ) : (
                selected.resolution && (
                  <div className="rounded-lg border border-success/20 bg-success/5 p-3 text-sm">
                    <p className="font-medium text-success">Resolution</p>
                    <p className="mt-1 text-muted-foreground">{selected.resolution}</p>
                  </div>
                )
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ConsolePage>
  );
};

export default ComplaintsPage;
