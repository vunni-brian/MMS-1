import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Filter,
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
  KpiStrip,
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
import type { Ticket, TicketCategory, TicketStatus } from "@/types";

type StatusFilter = "all" | TicketStatus;
type CategoryFilter = "all" | TicketCategory;

const categoryLabels: Record<TicketCategory, string> = {
  billing: "Billing",
  maintenance: "Maintenance",
  dispute: "Dispute",
  other: "Other",
};

const complaintSteps = ["Submitted", "Pending", "In Progress", "Resolved"];

const getComplaintStepIndex = (status: TicketStatus) => {
  if (status === "resolved") return 3;
  if (status === "in_progress") return 2;
  return 1;
};

const getComplaintStatusLabel = (status: TicketStatus) =>
  status === "open" ? "Pending" : undefined;

const getPriority = (ticket: Ticket) => {
  if (ticket.category === "dispute") return "High";
  if (ticket.category === "billing" || ticket.category === "maintenance") return "Medium";
  return "Normal";
};

const ticketStatusOptions: Array<{ value: TicketStatus; label: string }> = [
  { value: "open", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
];

const nextTicketStatusOptions = (status: TicketStatus) => {
  if (status === "open") return ticketStatusOptions.filter((option) => option.value !== "resolved");
  if (status === "in_progress") return ticketStatusOptions.filter((option) => option.value !== "open");
  return ticketStatusOptions.filter((option) => option.value === "resolved");
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

  const [newTicket, setNewTicket] = useState<{
    category: TicketCategory;
    subject: string;
    description: string;
    attachment: File | null;
  }>({
    category: "maintenance",
    subject: "",
    description: "",
    attachment: null,
  });

  const [managerUpdate, setManagerUpdate] = useState<{
    status: TicketStatus;
    resolutionNote: string;
    note: string;
  }>({
    status: "in_progress",
    resolutionNote: "",
    note: "",
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
        subject: "",
        description: "",
        attachment: null,
      });
      setError(null);
      toast.success("Complaint submitted", {
        description: "The ticket is now in the complaint register for review.",
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
    mutationFn: () => api.updateTicket(selected!.id, managerUpdate),
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

  const tickets = data?.tickets || [];

  const filteredTickets = tickets.filter((ticket) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      [
        ticket.id,
        ticket.subject,
        ticket.description,
        ticket.vendorName,
        categoryLabels[ticket.category],
        ticket.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);

    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || ticket.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const openTickets = tickets.filter((ticket) => ticket.status === "open");
  const inProgressTickets = tickets.filter((ticket) => ticket.status === "in_progress");
  const resolvedTickets = tickets.filter((ticket) => ticket.status === "resolved");
  const highPriorityTickets = tickets.filter((ticket) => getPriority(ticket) === "High");
  const canSubmitComplaint = Boolean(
    newTicket.category &&
      newTicket.subject.trim() &&
      newTicket.description.trim(),
  );
  const canUpdateSelectedTicket =
    Boolean(selected) &&
    (managerUpdate.status !== "resolved" || Boolean(managerUpdate.resolutionNote.trim()));
  const complaintKpis = [
    {
      label: "Total Tickets",
      value: tickets.length,
      detail: "All complaint records",
      icon: AlertCircle,
      tone: "default" as const,
    },
    {
      label: "Pending",
      value: openTickets.length,
      detail: "Awaiting manager action",
      icon: Clock3,
      tone: openTickets.length ? ("warning" as const) : ("default" as const),
    },
    {
      label: "In Progress",
      value: inProgressTickets.length,
      detail: "Currently being handled",
      icon: Clock3,
      tone: "info" as const,
    },
    {
      label: "High Priority",
      value: highPriorityTickets.length,
      detail: "Dispute-related cases",
      icon: AlertCircle,
      tone: highPriorityTickets.length ? ("destructive" as const) : ("success" as const),
    },
  ];

  return (
    <ConsolePage>
      <PageHeader
        eyebrow="Ticket desk"
        title="Complaints & Disputes"
        description={role === "vendor" ? "Submit and track market complaints." : "Prioritize complaints and update resolution status."}
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
          <KpiStrip items={complaintKpis} />

          <DataTableFrame
            title="Ticket Register"
            description="Operational queue for complaint handling."
            actions={
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                  <div className="relative w-full sm:w-[240px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Search tickets..."
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
                        <TableHead className="text-xs">Created</TableHead>
                        <TableHead className="text-right text-xs">Action</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {filteredTickets.map((ticket) => {
                        const priority = getPriority(ticket);
                        const priorityClasses =
                          priority === "High"
                            ? "border-destructive/20 bg-destructive/10 text-destructive"
                            : priority === "Medium"
                              ? "border-warning/20 bg-warning/10 text-warning-foreground"
                              : "border-border bg-muted text-muted-foreground";

                        return (
                          <TableRow key={ticket.id} className="text-xs">
                            <TableCell className="font-mono text-xs">#{ticket.id}</TableCell>

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
                              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${priorityClasses}`}>
                                {priority}
                              </span>
                            </TableCell>

                            <TableCell>
                              <StatusBadge
                                status={ticket.status}
                                label={getComplaintStatusLabel(ticket.status)}
                              />
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
              <Label htmlFor="complaint-description">Description</Label>
              <Textarea
                id="complaint-description"
                value={newTicket.description}
                onChange={(event) =>
                  setNewTicket((current) => ({ ...current, description: event.target.value }))
                }
                rows={4}
              />
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
            <DialogTitle className="font-heading">Ticket #{selected?.id}</DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vendor</span>
                  <span className="font-medium">{selected.vendorName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Category</span>
                  <span>{categoryLabels[selected.category]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge
                    status={selected.status}
                    label={getComplaintStatusLabel(selected.status)}
                  />
                </div>
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
                <p className="mb-2 font-medium">Update History</p>
                <div className="space-y-2">
                  {selected.updates.map((update) => (
                    <div key={update.id}>
                      <p className="font-medium">{update.actorName}</p>
                      <p className="text-muted-foreground">{update.note}</p>
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
                      Complaints move from Pending to In Progress before they can be resolved.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ticket-resolution-note">Resolution Note</Label>
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
                    <Label htmlFor="ticket-manager-note">Manager Note</Label>
                    <Textarea
                      id="ticket-manager-note"
                      value={managerUpdate.note}
                      onChange={(event) =>
                        setManagerUpdate((current) => ({ ...current, note: event.target.value }))
                      }
                      rows={2}
                    />
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => updateTicket.mutate()}
                    disabled={updateTicket.isPending || !canUpdateSelectedTicket}
                  >
                    Update Ticket
                  </Button>
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
