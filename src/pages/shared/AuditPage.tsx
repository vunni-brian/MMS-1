import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  Lock,
  Search,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { formatHumanDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ConsolePage,
  DataTableFrame,
  DetailSheet,
  EvidenceField,
  PageHeader,
} from "@/components/console/ConsolePage";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const AuditPage = () => {
  const { user } = useAuth();

  const [selectedMarketId, setSelectedMarketId] = useState("all");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const canScopeMarkets = user?.role === "official" || user?.role === "admin";
  const marketId =
    canScopeMarkets && selectedMarketId !== "all" ? selectedMarketId : undefined;

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

  const filteredEvents = events.filter((event) => {
    const term = search.trim().toLowerCase();

    const searchable = [
      event.marketName || "All markets",
      event.actorName,
      event.actorRole,
      event.action,
      event.entityType,
      event.entityId,
      event.details ? JSON.stringify(event.details) : "",
    ]
      .join(" ")
      .toLowerCase();

    const matchesSearch = !term || searchable.includes(term);

    const createdAt = new Date(event.createdAt).getTime();
    const afterFrom = !dateFrom || createdAt >= new Date(dateFrom).getTime();
    const beforeTo = !dateTo || createdAt <= new Date(dateTo).getTime();

    return matchesSearch && afterFrom && beforeTo;
  });

  const selectedEvent =
    events.find((event) => event.id === selectedEventId) || null;

  const exportCsv = () => {
    const headers = [
      "Timestamp",
      "Market",
      "Actor",
      "Role",
      "Action",
      "Entity Type",
      "Entity ID",
      "Details",
    ];

    const rows = filteredEvents.map((event) => [
      formatHumanDateTime(event.createdAt),
      event.marketName || "All markets",
      event.actorName,
      event.actorRole,
      event.action,
      event.entityType,
      event.entityId,
      event.details ? JSON.stringify(event.details) : "",
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `mms-activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <ConsolePage>
      <PageHeader
        eyebrow="Activity record"
        title="Activity Log"
        description="Read-only record of system activity and important changes."
        meta={
          <>
            <span className="rounded-full bg-muted px-2.5 py-1">
              Role: {user?.role}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
              <Lock className="h-3 w-3" />
              Read-only
            </span>
          </>
        }
      />

      <DataTableFrame
        className="workspace-primary-frame"
        title="Activity Records"
        description={`Who changed what, when, and in which market scope. Showing ${filteredEvents.length} of ${events.length} records.`}
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-end">
            {canScopeMarkets && (
              <div className="w-full sm:w-[210px]">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Market
                </label>
                <Select value={selectedMarketId} onValueChange={setSelectedMarketId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All markets" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All markets</SelectItem>
                    {(marketsData?.markets || []).map((market) => (
                      <SelectItem key={market.id} value={market.id}>
                        {market.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="w-full sm:w-[180px]">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                From
              </label>
              <Input
                type="datetime-local"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </div>

            <div className="w-full sm:w-[180px]">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                To
              </label>
              <Input
                type="datetime-local"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </div>

            <div className="w-full sm:w-[240px]">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Search
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search actor, action, entity, market..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setDateFrom("");
                setDateTo("");
              }}
            >
              Reset
            </Button>

            <Button onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        }
      >
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs">Timestamp</TableHead>
                    <TableHead className="text-xs">Market</TableHead>
                    <TableHead className="text-xs">Actor</TableHead>
                    <TableHead className="text-xs">Role</TableHead>
                    <TableHead className="text-xs">Action</TableHead>
                    <TableHead className="text-xs">Entity</TableHead>
                    <TableHead className="text-xs">Details</TableHead>
                    <TableHead className="text-right text-xs">Action</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredEvents.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="h-32 text-center text-sm text-muted-foreground"
                      >
                        No activity records match the selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEvents.map((event) => (
                      <TableRow key={event.id} className="text-xs">
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatHumanDateTime(event.createdAt)}
                        </TableCell>

                        <TableCell className="whitespace-nowrap text-xs">
                          {event.marketName || "All markets"}
                        </TableCell>

                        <TableCell className="whitespace-nowrap text-xs font-medium">
                          {event.actorName}
                        </TableCell>

                        <TableCell>
                          <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">
                            {event.actorRole}
                          </span>
                        </TableCell>

                        <TableCell>
                          <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
                            {event.action}
                          </span>
                        </TableCell>

                        <TableCell className="whitespace-nowrap text-xs">
                          {event.entityType} #{event.entityId}
                        </TableCell>

                        <TableCell className="max-w-[220px] text-xs text-muted-foreground">
                          {event.details ? (
                            <span className="block truncate font-mono text-[11px]" title={JSON.stringify(event.details)}>
                              {JSON.stringify(event.details).slice(0, 60)}
                              {JSON.stringify(event.details).length > 60 ? "…" : ""}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedEventId(event.id)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
      </DataTableFrame>

      <DetailSheet
        open={Boolean(selectedEventId)}
        onOpenChange={(open) => !open && setSelectedEventId(null)}
        title="Activity Detail"
        description="Detailed record of who changed what and where it happened."
      >
        {selectedEvent && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <EvidenceField
                label="Timestamp"
                value={formatHumanDateTime(selectedEvent.createdAt)}
              />
              <EvidenceField
                label="Market"
                value={selectedEvent.marketName || "All markets"}
              />
              <EvidenceField label="Actor" value={selectedEvent.actorName} />
              <EvidenceField label="Role" value={selectedEvent.actorRole} />
              <EvidenceField label="Action" value={selectedEvent.action} mono />
              <EvidenceField
                label="Entity"
                value={`${selectedEvent.entityType} #${selectedEvent.entityId}`}
                mono
              />
            </div>

            <div className="rounded-md border border-border/70 bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">Recorded Details</p>
              <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-md bg-background p-3 text-xs">
                {selectedEvent.details
                  ? JSON.stringify(selectedEvent.details, null, 2)
                  : "No details recorded."}
              </pre>
            </div>
          </div>
        )}
      </DetailSheet>
    </ConsolePage>
  );
};

export default AuditPage;
