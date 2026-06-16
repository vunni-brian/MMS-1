import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Send, Shield, UserCog } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatHumanDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/console/ConsolePage";
import { PageLayout } from "@/components/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ResourceRequest, ResourceRequestCategory } from "@/types";

const resourceCategoryLabels: Record<ResourceRequestCategory, string> = {
  budget: "Budget support",
  structural: "Structural work",
};

const CoordinationPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [requestCategory, setRequestCategory] = useState<ResourceRequestCategory>("budget");
  const [requestTitle, setRequestTitle] = useState("");
  const [requestDescription, setRequestDescription] = useState("");
  const [requestAmount, setRequestAmount] = useState("");
  const [selectedMarketId, setSelectedMarketId] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmReview, setConfirmReview] = useState<{ request: ResourceRequest; action: "approved" | "rejected" } | null>(null);

  const canScopeMarkets = user?.role === "official" || user?.role === "admin";
  const canCreateResourceRequest = user?.role === "manager";
  const canReviewResourceRequest = user?.role === "official" || user?.role === "admin";
  const showResourceRequests = canCreateResourceRequest || canReviewResourceRequest;
  const marketId = canScopeMarkets && selectedMarketId !== "all" ? selectedMarketId : undefined;

  const { data: marketsData } = useQuery({ queryKey: ["markets", "coordination"], queryFn: () => api.getMarkets(), enabled: canScopeMarkets });
  const { data } = useQuery({ queryKey: ["coordination-messages", marketId || "all"], queryFn: () => api.getCoordinationMessages(marketId), refetchInterval: 10_000 });
  const { data: resourceRequestsData } = useQuery({ queryKey: ["resource-requests", marketId || "all"], queryFn: () => api.getResourceRequests(marketId), enabled: showResourceRequests });

  const postMessage = useMutation({
    mutationFn: () => api.postCoordinationMessage(subject, body, marketId),
    onMutate: () => { setError(null); setSuccess(null); },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["coordination-messages"] });
      setSubject(""); setBody("");
      setSuccess("Message sent successfully.");
    },
    onError: (error) => { setError(error instanceof ApiError ? error.message : "Unable to send request update."); },
  });

  const createResourceRequest = useMutation({
    mutationFn: () => api.createResourceRequest({ category: requestCategory, title: requestTitle, description: requestDescription, amountRequested: Number(requestAmount) }),
    onMutate: () => { setError(null); setSuccess(null); },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["resource-requests"] });
      setRequestCategory("budget"); setRequestTitle(""); setRequestDescription(""); setRequestAmount("");
      setSuccess("Resource request submitted successfully.");
    },
    onError: (error) => { setError(error instanceof ApiError ? error.message : "Unable to submit resource request."); },
  });

  const reviewResourceRequest = useMutation({
    mutationFn: ({ request, status }: { request: ResourceRequest; status: "approved" | "rejected" }) =>
      api.reviewResourceRequest(request.id, { status, approvedAmount: status === "approved" ? request.amountRequested : null, reviewNote: status === "approved" ? "Approved for operational follow-up." : "Rejected from request review." }),
    onMutate: () => { setError(null); setSuccess(null); },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["resource-requests"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setSuccess("Resource request reviewed successfully.");
    },
    onError: (error) => { setError(error instanceof ApiError ? error.message : "Unable to review resource request."); },
  });

  const messages = data?.messages || [];
  const resourceRequests = resourceRequestsData?.requests || [];
  const pendingRequests = resourceRequests.filter((r) => r.status === "pending");
  const approvedRequests = resourceRequests.filter((r) => r.status === "approved");
  const requestedTotal = pendingRequests.reduce((sum, r) => sum + r.amountRequested, 0);

  return (
    <PageLayout>
      <PageHeader
        eyebrow="Operations queue"
        title="Requests"
        subtitle="Review resource requests and post market coordination updates."
        actions={
          canScopeMarkets ? (
            <select value={selectedMarketId} onChange={(e) => setSelectedMarketId(e.target.value)} className="h-9 rounded-lg border-2 border-slate-300 bg-white px-3 text-sm focus:border-primary focus:outline-none">
              <option value="all">All Markets</option>
              {(marketsData?.markets || []).map((market) => <option key={market.id} value={market.id}>{market.name}</option>)}
            </select>
          ) : undefined
        }
      />

      {/* Summary strip */}
      {showResourceRequests && (
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Pending requests", value: pendingRequests.length, sub: `${formatCurrency(requestedTotal)} awaiting decision`, tone: pendingRequests.length ? "amber" as const : "green" as const },
            { label: "Approved", value: approvedRequests.length, sub: "Ready for follow-up", tone: "green" as const },
            { label: "Updates posted", value: messages.length, sub: "Coordination notes in scope", tone: "slate" as const },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-slate-600">{item.label}</p>
              <p className="mt-2 text-2xl font-bold text-slate-950 font-heading">{item.value}</p>
              <p className="mt-1 text-xs text-slate-500">{item.sub}</p>
            </div>
          ))}
        </div>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">

        {/* Resource requests */}
        {showResourceRequests && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
                <CardTitle className="text-base font-medium">Resource Requests</CardTitle>
                <Badge variant={pendingRequests.length ? "warning" : "success"}>{pendingRequests.length} pending</Badge>
              </CardHeader>
              <CardContent className="p-4">
              <div className={canCreateResourceRequest ? "grid gap-4 lg:grid-cols-[1fr_1.2fr]" : ""}>
                {/* Create form */}
                {canCreateResourceRequest && (
                  <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="request-type" className="font-bold text-slate-700">Request type</Label>
                      <Select value={requestCategory} onValueChange={(v) => setRequestCategory(v as ResourceRequestCategory)}>
                        <SelectTrigger id="request-type" className="border-slate-300 rounded-lg"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="budget">Budget support</SelectItem>
                          <SelectItem value="structural">Structural work</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="request-title" className="font-bold text-slate-700">Title</Label>
                      <Input id="request-title" className="border-slate-300 rounded-lg focus-visible:border-primary focus-visible:ring-0" value={requestTitle} onChange={(e) => setRequestTitle(e.target.value)} placeholder="Drainage repair, electrical inspection..." />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="request-amount" className="font-bold text-slate-700">Amount requested</Label>
                      <Input id="request-amount" type="number" min="0" className="border-slate-300 rounded-lg focus-visible:border-primary focus-visible:ring-0" value={requestAmount} onChange={(e) => setRequestAmount(e.target.value)} placeholder="0" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="request-need" className="font-bold text-slate-700">Need</Label>
                      <Textarea id="request-need" className="border-slate-300 rounded-lg focus-visible:border-primary focus-visible:ring-0" rows={4} value={requestDescription} onChange={(e) => setRequestDescription(e.target.value)} placeholder="Explain the operational risk, affected section, and expected outcome." />
                    </div>
                    <Button className="w-full rounded-lg shadow-none bg-primary hover:bg-primary/90 font-bold" onClick={() => createResourceRequest.mutate()} disabled={createResourceRequest.isPending}>
                      Submit Request
                    </Button>
                  </div>
                )}

                {/* Request list */}
                <div className={`space-y-3 ${!canCreateResourceRequest ? "lg:col-span-2" : ""}`}>
                  {resourceRequests.slice(0, 6).length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-400">
                      No resource requests yet. Manager requests for budget or structural support will appear here.
                    </div>
                  ) : (
                    resourceRequests.slice(0, 6).map((request) => (
                      <div key={request.id} className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-bold text-slate-900">{request.title}</p>
                              <StatusBadge status={request.status} />
                            </div>
                            <p className="mt-1 text-sm text-slate-500">{resourceCategoryLabels[request.category]} — {request.marketName}</p>
                            <p className="mt-1 text-sm text-slate-600">{request.description}</p>
                            <p className="mt-2 text-xs text-slate-400">{request.managerName} · {formatHumanDateTime(request.createdAt)}</p>
                          </div>
                          <div className="shrink-0 text-left md:text-right">
                            <p className="font-bold text-slate-900">{formatCurrency(request.amountRequested)}</p>
                            {request.approvedAmount && (
                              <p className="mt-1 text-xs text-emerald-600">Approved: {formatCurrency(request.approvedAmount)}</p>
                            )}
                            {canReviewResourceRequest && request.status === "pending" && (
                              <div className="mt-3 flex flex-wrap gap-2 md:justify-end">
                                <Button size="sm" className="rounded-lg shadow-none bg-emerald-600 hover:bg-emerald-700 font-bold" onClick={() => setConfirmReview({ request, action: "approved" })} disabled={reviewResourceRequest.isPending}>
                                  Approve
                                </Button>
                                <Button size="sm" variant="outline" className="rounded-lg border-slate-300 font-bold" onClick={() => setConfirmReview({ request, action: "rejected" })} disabled={reviewResourceRequest.isPending}>
                                  Reject
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Right column: updates + compose */}
        <div className="space-y-4">
          {/* Updates feed */}
          <Card>
            <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
              <CardTitle className="text-base font-medium">Updates</CardTitle>
              <span className="text-xs text-slate-400">{messages.length} notes</span>
            </CardHeader>
            <CardContent className="p-4">
            {messages.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-400">No request updates yet.</div>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => {
                  const Icon = message.senderRole === "manager" ? UserCog : Shield;
                  return (
                    <div key={message.id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{message.senderName}</p>
                            <p className="text-xs capitalize text-slate-400">{message.senderRole}{message.marketName ? ` · ${message.marketName}` : " · All markets"}</p>
                          </div>
                        </div>
                        <p className="whitespace-nowrap text-xs text-slate-400">{formatHumanDateTime(message.createdAt)}</p>
                      </div>
                      <div className="mt-3">
                        <p className="font-bold text-sm text-slate-900">{message.subject}</p>
                        <p className="mt-1 text-sm text-slate-600">{message.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            </CardContent>
          </Card>

          {/* Compose */}
          <Card>
            <CardHeader className="flex min-h-12 flex-row items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
              <CardTitle className="text-base font-medium">Send Update</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="coord-subject" className="font-bold text-slate-700">Subject</Label>
                <Input id="coord-subject" className="border-slate-300 rounded-lg focus-visible:border-primary focus-visible:ring-0" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Weekly update, monitoring note, action request..." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="coord-message" className="font-bold text-slate-700">Message</Label>
                <Textarea id="coord-message" className="border-slate-300 rounded-lg focus-visible:border-primary focus-visible:ring-0" rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a concise operational update or request." />
              </div>

              {success && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {success}
                </div>
              )}

              <Button className="w-full rounded-lg shadow-none bg-primary hover:bg-primary/90 font-bold gap-2" onClick={() => postMessage.mutate()} disabled={postMessage.isPending || !subject.trim() || !body.trim()}>
                <Send className="h-4 w-4" />
                {postMessage.isPending ? "Sending..." : "Send Update"}
              </Button>
            </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation dialog */}
      <Dialog open={Boolean(confirmReview)} onOpenChange={(open) => !open && setConfirmReview(null)}>
        <DialogContent className="rounded-lg">
          <DialogHeader>
            <DialogTitle className="font-bold text-slate-900">
              {confirmReview?.action === "approved" ? "Approve Request" : "Reject Request"}
            </DialogTitle>
            <DialogDescription>
              {confirmReview?.action === "approved"
                ? `Approve "${confirmReview.request.title}" from ${confirmReview.request.managerName} for ${formatCurrency(confirmReview.request.amountRequested)}? This will notify the manager.`
                : `Reject "${confirmReview?.request.title}" from ${confirmReview?.request.managerName}? The manager will be notified.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-lg border-slate-300 font-bold" onClick={() => setConfirmReview(null)}>Cancel</Button>
            <Button
              className={`rounded-lg shadow-none font-bold ${confirmReview?.action === "approved" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}
              disabled={reviewResourceRequest.isPending}
              onClick={() => {
                if (!confirmReview) return;
                reviewResourceRequest.mutate({ request: confirmReview.request, status: confirmReview.action });
                setConfirmReview(null);
              }}
            >
              {confirmReview?.action === "approved" ? "Yes, Approve" : "Yes, Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
};

export default CoordinationPage;
