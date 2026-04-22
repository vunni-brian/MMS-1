import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Plus, Upload, AlertCircle } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { formatHumanDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import type { Ticket, TicketCategory, TicketStatus } from "@/types";

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

const getComplaintStatusLabel = (status: TicketStatus) => (status === "open" ? "Pending" : undefined);

const ComplaintProgress = ({ status }: { status: TicketStatus }) => {
  const activeIndex = getComplaintStepIndex(status);

  return (
    <div className="space-y-2">
      <Progress value={(activeIndex / (complaintSteps.length - 1)) * 100} className="h-2" />
      <div className="grid grid-cols-4 gap-2 text-[11px] font-medium">
        {complaintSteps.map((step, index) => (
          <div key={step} className={index <= activeIndex ? "text-foreground" : "text-muted-foreground"}>
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
    },
    onError: (error) => setError(error instanceof ApiError ? error.message : "Unable to create ticket."),
  });

  const updateTicket = useMutation({
    mutationFn: () => api.updateTicket(selected!.id, managerUpdate),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setSelected(null);
      setError(null);
    },
    onError: (error) => setError(error instanceof ApiError ? error.message : "Unable to update ticket."),
  });

  const tickets = data?.tickets || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Complaints & Disputes</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {role === "vendor" ? "Lodge and track your complaints" : "Manage vendor complaints"}
          </p>
        </div>
        {role === "vendor" && (
          <Button onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4 mr-1" />
            New Complaint
          </Button>
        )}
      </div>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>}

      {isError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading complaints</AlertTitle>
          <AlertDescription>We couldn't reach the server. Please check your connection.</AlertDescription>
        </Alert>
      ) : isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-[104px] w-full rounded-xl" />
          <Skeleton className="h-[104px] w-full rounded-xl" />
          <Skeleton className="h-[104px] w-full rounded-xl" />
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No complaints found.</p>
          ) : (
            tickets.map((ticket) => (
              <Card key={ticket.id} className="card-warm cursor-pointer" onClick={() => {
                setSelected(ticket);
                setManagerUpdate({
                  status: ticket.status,
                  resolutionNote: ticket.resolution || "",
                  note: "",
                });
              }}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium bg-muted px-2 py-0.5 rounded">{categoryLabels[ticket.category]}</span>
                        <span className="text-xs text-muted-foreground">#{ticket.id}</span>
                      </div>
                      <p className="font-medium text-sm">{ticket.subject}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {role !== "vendor" ? `${ticket.vendorName} - ` : ""}
                        {formatHumanDateTime(ticket.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={ticket.status} label={getComplaintStatusLabel(ticket.status)} />
                  </div>
                  <div className="mt-4">
                    <ComplaintProgress status={ticket.status} />
                  </div>
                  {ticket.resolution && (
                    <div className="mt-3 p-2.5 rounded-lg bg-success/5 border border-success/20">
                      <p className="text-xs font-medium text-success">Resolution</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{ticket.resolution}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Lodge a Complaint</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={newTicket.category} onValueChange={(value: TicketCategory) => setNewTicket((current) => ({ ...current, category: value }))}>
                <SelectTrigger>
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
              <Label>Subject</Label>
              <Input value={newTicket.subject} onChange={(event) => setNewTicket((current) => ({ ...current, subject: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={newTicket.description} onChange={(event) => setNewTicket((current) => ({ ...current, description: event.target.value }))} rows={4} />
            </div>
            <div className="space-y-1.5">
              <Label>Attachment (optional)</Label>
              <label className="border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:border-foreground/25 transition-colors block">
                <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground">{newTicket.attachment ? newTicket.attachment.name : "Click to upload a photo or document"}</p>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(event) => setNewTicket((current) => ({ ...current, attachment: event.target.files?.[0] || null }))}
                />
              </label>
            </div>
            <Button className="w-full" onClick={() => createTicket.mutate()} disabled={createTicket.isPending}>
              Submit Complaint
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selected)} onOpenChange={() => setSelected(null)}>
        <DialogContent>
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
                  <StatusBadge status={selected.status} label={getComplaintStatusLabel(selected.status)} />
                </div>
              </div>
              <ComplaintProgress status={selected.status} />
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm">{selected.description}</p>
              </div>

              {selected.attachments.length > 0 && (
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <p className="font-medium mb-2">Attachments</p>
                  {selected.attachments.map((attachment) => (
                    <p key={attachment.id} className="text-muted-foreground">{attachment.name}</p>
                  ))}
                </div>
              )}

              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="font-medium mb-2">Update History</p>
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
                    <Label>Update Status</Label>
                    <Select value={managerUpdate.status} onValueChange={(value: TicketStatus) => setManagerUpdate((current) => ({ ...current, status: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Resolution Note</Label>
                    <Textarea
                      value={managerUpdate.resolutionNote}
                      onChange={(event) => setManagerUpdate((current) => ({ ...current, resolutionNote: event.target.value }))}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Manager Note</Label>
                    <Textarea
                      value={managerUpdate.note}
                      onChange={(event) => setManagerUpdate((current) => ({ ...current, note: event.target.value }))}
                      rows={2}
                    />
                  </div>
                  <Button className="w-full" onClick={() => updateTicket.mutate()} disabled={updateTicket.isPending}>
                    Update Ticket
                  </Button>
                </>
              ) : (
                selected.resolution && (
                  <div className="rounded-lg bg-success/5 border border-success/20 p-3 text-sm">
                    <p className="font-medium text-success">Resolution</p>
                    <p className="text-muted-foreground mt-1">{selected.resolution}</p>
                  </div>
                )
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ComplaintsPage;
