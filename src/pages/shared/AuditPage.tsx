import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const AuditPage = () => {
  const { user } = useAuth();
  const [selectedMarketId, setSelectedMarketId] = useState("all");
  const marketId = user?.role === "official" && selectedMarketId !== "all" ? selectedMarketId : undefined;
  const { data: marketsData } = useQuery({
    queryKey: ["markets", "audit"],
    queryFn: () => api.getMarkets(),
    enabled: user?.role === "official",
  });
  const { data } = useQuery({
    queryKey: ["audit", marketId || "all"],
    queryFn: () => api.getAudit(marketId),
  });

  const events = data?.events || [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Audit Trail</h1>
          <p className="text-muted-foreground text-sm mt-1">Immutable log of all system actions</p>
        </div>
        <div className="flex items-center gap-3">
          {user?.role === "official" && (
            <div className="space-y-1 min-w-[220px]">
              <Label className="text-xs">Market</Label>
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
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
            <Lock className="w-3 h-3" />
            Read-only
          </div>
        </div>
      </div>

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
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{new Date(event.createdAt).toLocaleString()}</TableCell>
                    <TableCell className="text-sm">{event.marketName || "All markets"}</TableCell>
                    <TableCell className="font-medium text-sm">{event.actorName}</TableCell>
                    <TableCell>
                      <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded capitalize">{event.actorRole}</span>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditPage;
