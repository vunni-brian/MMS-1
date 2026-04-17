import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Send, Shield, UserCog } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { formatHumanDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const CoordinationPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedMarketId, setSelectedMarketId] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const canScopeMarkets = user?.role === "official" || user?.role === "admin";
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

  const messages = data?.messages || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading">Manager & Official Coordination</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Share operational updates, oversight requests, and action items.
        </p>
      </div>

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
