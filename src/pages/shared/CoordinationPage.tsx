import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, Send, Shield, UserCog } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatHumanDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/console/ConsolePage";
import { StatusBadge } from "@/components/StatusBadge";
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
  const canScopeMarkets = user?.role === "official" || user?.role === "admin";
  const canCreateResourceRequest = user?.role === "manager";
  const canReviewResourceRequest = user?.role === "official" || user?.role === "admin";
  const showResourceRequests = canCreateResourceRequest || canReviewResourceRequest;
  const marketId = canScopeMarkets && selectedMarketId !== "all" ? selectedMarketId : undefined;

  const { data: marketsData } = useQuery({
    queryKey: ["markets", "coordination"],
    queryFn: () => api.getMarkets(),
    enabled: canScopeMarkets,
  });

  const { data } = useQuery({
    queryKey: ["coordination-messages", marketId || "all"],
    queryFn: () => api.getCoordinationMessages(marketId),
    refetchInterval: 10_000,
  });

  const { data: resourceRequestsData } = useQuery({
    queryKey: ["resource-requests", marketId || "all"],
    queryFn: () => api.getResourceRequests(marketId),
    enabled: showResourceRequests,
  });

  const postMessage = useMutation({
    mutationFn: () => api.postCoordinationMessage(subject, body, marketId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["coordination-messages"] });
      setSubject("");
      setBody("");
      setError(null);
      setSuccess("Message sent successfully.");
    },
    onError: (error) => {
      setSuccess(null);
      setError(error instanceof ApiError ? error.message : "Unable to send coordination message.");
    },
  });

  const createResourceRequest = useMutation({
    mutationFn: () =>
      api.createResourceRequest({
        category: requestCategory,
        title: requestTitle,
        description: requestDescription,
        amountRequested: Number(requestAmount),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["resource-requests"] });
      setRequestCategory("budget");
      setRequestTitle("");
      setRequestDescription("");
      setRequestAmount("");
      setError(null);
      setSuccess("Resource request submitted successfully.");
    },
    onError: (error) => {
      setSuccess(null);
      setError(error instanceof ApiError ? error.message : "Unable to submit resource request.");
    },
  });

  const reviewResourceRequest = useMutation({
    mutationFn: ({ request, status }: { request: ResourceRequest; status: "approved" | "rejected" }) =>
      api.reviewResourceRequest(request.id, {
        status,
        approvedAmount: status === "approved" ? request.amountRequested : null,
        reviewNote:
          status === "approved"
            ? "Approved for operational follow-up."
            : "Rejected from coordination review.",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["resource-requests"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setError(null);
      setSuccess("Resource request reviewed successfully.");
    },
    onError: (error) => {
      setSuccess(null);
      setError(error instanceof ApiError ? error.message : "Unable to review resource request.");
    },
  });

  const messages = data?.messages || [];
  const resourceRequests = resourceRequestsData?.requests || [];
  const visibleResourceRequests = resourceRequests.slice(0, 6);
  const pendingResourceRequests = resourceRequests.filter((request) => request.status === "pending");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading">Manager & Official Coordination</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Share operational updates, oversight requests, and action items.
        </p>
      </div>

      {showResourceRequests && (
        <Card className="card-warm">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-heading">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                  Resource Requests
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Budget and structural requests that require official review.
                </p>
              </div>
              <span className="status-badge border-warning/25 bg-warning/15 text-warning">
                {pendingResourceRequests.length} pending
              </span>
            </div>
          </CardHeader>

          <CardContent className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
            {canCreateResourceRequest && (
              <div className="space-y-3 rounded-lg border border-border/70 bg-background p-3">
                <div className="space-y-1.5">
                  <Label htmlFor="resource-category">Request type</Label>
                  <Select value={requestCategory} onValueChange={(value) => setRequestCategory(value as ResourceRequestCategory)}>
                    <SelectTrigger id="resource-category">
                      <SelectValue placeholder="Select request type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="budget">Budget support</SelectItem>
                      <SelectItem value="structural">Structural work</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="resource-title">Title</Label>
                  <Input
                    id="resource-title"
                    value={requestTitle}
                    onChange={(event) => setRequestTitle(event.target.value)}
                    placeholder="Drainage repair, electrical inspection..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="resource-amount">Amount requested</Label>
                  <Input
                    id="resource-amount"
                    type="number"
                    min="0"
                    value={requestAmount}
                    onChange={(event) => setRequestAmount(event.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="resource-description">Operational need</Label>
                  <Textarea
                    id="resource-description"
                    value={requestDescription}
                    onChange={(event) => setRequestDescription(event.target.value)}
                    rows={4}
                    placeholder="Explain the operational risk, affected section, and expected outcome."
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => createResourceRequest.mutate()}
                  disabled={createResourceRequest.isPending}
                >
                  Submit Request
                </Button>
              </div>
            )}

            <div className={canCreateResourceRequest ? "space-y-2" : "space-y-2 lg:col-span-2"}>
              {visibleResourceRequests.length === 0 ? (
                <EmptyState
                  title="No resource requests"
                  description="Manager requests for budget or structural support will appear here."
                />
              ) : (
                visibleResourceRequests.map((request) => (
                  <div key={request.id} className="rounded-lg border border-border/70 bg-background p-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{request.title}</p>
                          <StatusBadge status={request.status} />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {resourceCategoryLabels[request.category]} - {request.marketName}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">{request.description}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {request.managerName} - {formatHumanDateTime(request.createdAt)}
                        </p>
                      </div>
                      <div className="shrink-0 text-left md:text-right">
                        <p className="font-semibold">{formatCurrency(request.amountRequested)}</p>
                        {request.approvedAmount && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Approved: {formatCurrency(request.approvedAmount)}
                          </p>
                        )}
                        {canReviewResourceRequest && request.status === "pending" && (
                          <div className="mt-3 flex flex-wrap gap-2 md:justify-end">
                            <Button
                              size="sm"
                              onClick={() => reviewResourceRequest.mutate({ request, status: "approved" })}
                              disabled={reviewResourceRequest.isPending}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => reviewResourceRequest.mutate({ request, status: "rejected" })}
                              disabled={reviewResourceRequest.isPending}
                            >
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
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-4">
        <Card className="card-warm">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="text-base font-heading">Shared Channel</CardTitle>
              {canScopeMarkets && (
                <div className="w-full lg:w-[220px]">
                  <Select value={selectedMarketId} onValueChange={setSelectedMarketId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by market" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Markets</SelectItem>
                      {(marketsData?.markets || []).map((market) => (
                        <SelectItem key={market.id} value={market.id}>
                          {market.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No coordination messages yet.</p>
            ) : (
              messages.map((message) => {
                const Icon = message.senderRole === "manager" ? UserCog : Shield;

                return (
                  <div key={message.id} className="interactive-row border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{message.senderName}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {message.senderRole}
                            {message.marketName ? ` - ${message.marketName}` : " - All markets"}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatHumanDateTime(message.createdAt)}
                      </p>
                    </div>
                    <div className="mt-3">
                      <p className="font-heading font-semibold text-sm">{message.subject}</p>
                      <p className="text-sm text-muted-foreground mt-1">{message.body}</p>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="card-warm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Post Update</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {canScopeMarkets && (
              <div className="space-y-1.5">
                <Label htmlFor="coordination-market">Market scope</Label>
                <Select value={selectedMarketId} onValueChange={setSelectedMarketId}>
                  <SelectTrigger id="coordination-market">
                    <SelectValue placeholder="Select message scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Markets</SelectItem>
                    {(marketsData?.markets || []).map((market) => (
                      <SelectItem key={market.id} value={market.id}>
                        {market.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="coordination-subject">Subject</Label>
              <Input
                id="coordination-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Weekly update, oversight note, action request..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coordination-body">Message</Label>
              <Textarea
                id="coordination-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={6}
                placeholder="Write a concise operational update or request."
              />
            </div>
            {success && (
              <div className="flex items-center gap-2 rounded-lg border border-success/25 bg-success/10 px-3 py-2 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" />
                {success}
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <Button className="w-full" onClick={() => postMessage.mutate()} disabled={postMessage.isPending}>
              <Send className="w-4 h-4 mr-2" />
              Send Message
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CoordinationPage;
