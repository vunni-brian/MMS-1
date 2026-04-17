import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Database, Lock, ReceiptText, ShieldCheck } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { formatHumanDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConsolePage, DetailSheet, EvidenceField, KpiStrip, PageHeader, ScopeBar, ScopeItem } from "@/components/console/ConsolePage";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const AuditPage = () => {
  const { user } = useAuth();
  const [selectedMarketId, setSelectedMarketId] = useState("all");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const canScopeMarkets = user?.role === "official" || user?.role === "admin";
  const marketId = canScopeMarkets && selectedMarketId !== "all" ? selectedMarketId : undefined;
  const { data: marketsData } = useQuery({
    queryKey: ["markets", "audit"],
    queryFn: () => api.getMarkets(),
    enabled: canScopeMarkets,
  });
  const { data } = useQuery({
    queryKey: ["audit", marketId || "all"],
    queryFn: () => api.getAudit(marketId),
  });

  const events = data?.events || [];
  const selectedEvent = events.find((event) => event.id === selectedEventId) || null;
  const paymentEvents = events.filter((event) => event.action.includes("PAYMENT")).length;
  const actorCount = new Set(events.map((event) => event.actorUserId || event.actorName)).size;
  const marketCount = new Set(events.map((event) => event.marketId || "all")).size;
  const auditKpis = [
    { label: "Audit Events", value: events.length, detail: "Immutable records in this scope", icon: Database, tone: "default" as const },
    { label: "Payment Evidence", value: paymentEvents, detail: "Payment lifecycle events", icon: ReceiptText, tone: "info" as const },
    { label: "Actors", value: actorCount, detail: "People or system actors recorded", icon: Activity, tone: "default" as const },
    { label: "Market Scopes", value: marketCount, detail: selectedMarketId === "all" ? "Across all accessible markets" : "Selected market only", icon: ShieldCheck, tone: "success" as const },
  ];

  return (
    <ConsolePage>
      <PageHeader
        eyebrow="Evidence layer"
        title="Audit Trail"
        description="Read-only operational evidence for payments, billing changes, vendor actions, complaints, resource requests, and market-scoped governance."
        meta={
          <>
            <span className="rounded-full bg-muted px-2.5 py-1">Role: {user?.role}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1"><Lock className="h-3 w-3" /> Read-only</span>
          </>
        }
      />

      <ScopeBar>
          {canScopeMarkets && (
            <ScopeItem label="Market scope" className="w-full sm:w-[260px]">
              <Select value={selectedMarketId} onValueChange={setSelectedMarketId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select market" />
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
            </ScopeItem>
          )}
        <ScopeItem label="Evidence policy">
          <div className="rounded-md border border-border/70 bg-background px-3 py-2 text-sm">Append-only operational log</div>
        </ScopeItem>
        <ScopeItem label="Primary action">
          <div className="rounded-md border border-border/70 bg-background px-3 py-2 text-sm">Inspect event evidence</div>
        </ScopeItem>
      </ScopeBar>

      <KpiStrip items={auditKpis} />

      <Card className="card-warm">
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Market</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{formatHumanDateTime(event.createdAt)}</TableCell>
                    <TableCell className="text-sm">{event.marketName || "All markets"}</TableCell>
                    <TableCell className="font-medium text-sm">{event.actorName}</TableCell>
                    <TableCell>
                      <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">{event.actorRole}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{event.action}</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {event.entityType} #{event.entityId}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                      {event.details ? JSON.stringify(event.details) : "No details"}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setSelectedEventId(event.id)}>Inspect</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <DetailSheet
        open={Boolean(selectedEventId)}
        onOpenChange={(open) => !open && setSelectedEventId(null)}
        title="Audit Event Evidence"
        description="Detailed record of who changed what, where it happened, and the captured evidence payload."
      >
        {selectedEvent && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <EvidenceField label="Timestamp" value={formatHumanDateTime(selectedEvent.createdAt)} />
              <EvidenceField label="Market" value={selectedEvent.marketName || "All markets"} />
              <EvidenceField label="Actor" value={selectedEvent.actorName} />
              <EvidenceField label="Role" value={selectedEvent.actorRole} />
              <EvidenceField label="Action" value={selectedEvent.action} mono />
              <EvidenceField label="Entity" value={`${selectedEvent.entityType} #${selectedEvent.entityId}`} mono />
            </div>
            <div className="rounded-md border border-border/70 bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">Evidence Payload</p>
              <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-md bg-background p-3 text-xs">
                {selectedEvent.details ? JSON.stringify(selectedEvent.details, null, 2) : "No details recorded."}
              </pre>
            </div>
          </div>
        )}
      </DetailSheet>
    </ConsolePage>
  );
};

export default AuditPage;
