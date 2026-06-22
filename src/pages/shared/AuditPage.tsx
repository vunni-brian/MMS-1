/**
 * Shared audit log page displaying role-scoped system events with detail sheet.
 * Accessible to manager, official, and admin roles.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Download, Lock, Search } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { formatHumanDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageLayout } from "@/components/PageLayout";
import { DataTableFrame } from "@/components/ui/DataTableFrame";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

/** AuditPage - renders the audit event log with search, detail sheet, and CSV export. */
const AuditPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [selectedMarketId, setSelectedMarketId] = useState("all");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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

  const filteredEvents = events.filter((event) => {
    const term = search.trim().toLowerCase();
    const searchable = [event.marketName || t("audit:allMarkets"), event.actorName, event.actorRole, event.action, event.entityType, event.entityId, event.details ? JSON.stringify(event.details) : ""].join(" ").toLowerCase();
    const matchesSearch = !term || searchable.includes(term);
    const createdAt = new Date(event.createdAt).getTime();
    const afterFrom = !dateFrom || createdAt >= new Date(dateFrom).getTime();
    const beforeTo = !dateTo || createdAt <= new Date(dateTo).getTime();
    return matchesSearch && afterFrom && beforeTo;
  });

  const selectedEvent = events.find((e) => e.id === selectedEventId) || null;
  const hasFilters = Boolean(search || dateFrom || dateTo || (canScopeMarkets && selectedMarketId !== "all"));

  const exportCsv = () => {
    const headers = [t("audit:timestamp"), t("audit:market"), t("audit:actor"), t("audit:role"), t("audit:action"), t("audit:entityType"), t("audit:entityId"), t("audit:details")];
    const rows = filteredEvents.map((event) => [
      formatHumanDateTime(event.createdAt), event.marketName || t("audit:allMarkets"),
      event.actorName, event.actorRole, event.action, event.entityType, event.entityId,
      event.details ? JSON.stringify(event.details) : "",
    ]);
    const csv = [headers, ...rows].map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mms-activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageLayout>
      <PageHeader
        eyebrow={t("audit:eyebrow")}
        title={t("audit:title")}
        description={t("audit:subtitle")}
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
              <Lock className="h-3 w-3" />
              {t("audit:readOnly")}
            </span>
            <Button onClick={exportCsv} className="h-9 gap-2 rounded-lg shadow-none font-bold">
              <Download className="h-4 w-4" />
              {t("audit:exportCsv")}
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        {canScopeMarkets && (
          <div className="space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{t("audit:market")}</p>
            <select
              value={selectedMarketId}
              onChange={(e) => setSelectedMarketId(e.target.value)}
              className="h-9 min-w-[200px] rounded-lg border-2 border-slate-300 bg-white px-3 text-sm focus:border-primary focus:outline-none"
            >
              <option value="all">{t("audit:allMarkets")}</option>
              {(marketsData?.markets || []).map((market) => (
                <option key={market.id} value={market.id}>{market.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{t("audit:from")}</p>
          <Input type="datetime-local" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-[190px] border-2 border-slate-300 rounded-lg focus-visible:border-primary focus-visible:ring-0" />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{t("audit:to")}</p>
          <Input type="datetime-local" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-[190px] border-2 border-slate-300 rounded-lg focus-visible:border-primary focus-visible:ring-0" />
        </div>
        <div className="space-y-1.5 flex-1 min-w-[220px]">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{t("audit:search")}</p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9 border-2 border-slate-300 rounded-lg focus-visible:border-primary focus-visible:ring-0 h-9"
              placeholder={t("audit:searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        {hasFilters && (
          <div className="flex items-end">
            <Button variant="outline" className="h-9 rounded-lg border-slate-300 font-bold" onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); setSelectedMarketId("all"); }}>
              {t("audit:reset")}
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <DataTableFrame title={t("audit:activityRecords", { filtered: filteredEvents.length, total: events.length })}>
        {filteredEvents.length === 0 ? (
          <EmptyState title={t("audit:noRecords")} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-600">{t("audit:timestamp")}</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-600">{t("audit:market")}</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-600">{t("audit:actor")}</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-600">{t("audit:role")}</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-600">{t("audit:action")}</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-600">{t("audit:entity")}</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-600">{t("audit:details")}</TableHead>
                  <TableHead className="text-right text-xs font-bold uppercase tracking-wider text-slate-600">{t("common:view")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.map((event) => (
                  <TableRow key={event.id} className="hover:bg-slate-50">
                    <TableCell className="whitespace-nowrap text-xs text-slate-500">{formatHumanDateTime(event.createdAt)}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-slate-700">{event.marketName || t("audit:allMarkets")}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs font-semibold text-slate-900">{event.actorName}</TableCell>
                    <TableCell>
                      <span className="rounded-lg border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-600">
                        {event.actorRole}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="rounded-lg border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700">
                        {event.action}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-slate-600">
                      {event.entityType} <span className="text-slate-400">#{event.entityId}</span>
                    </TableCell>
                    <TableCell className="max-w-[200px] text-xs text-slate-500">
                      {event.details ? (
                        <span className="block truncate font-mono text-[11px]" title={JSON.stringify(event.details)}>
                          {JSON.stringify(event.details).slice(0, 55)}{JSON.stringify(event.details).length > 55 ? "…" : ""}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" className="h-7 rounded-lg border-slate-300 px-2 text-xs font-bold" onClick={() => setSelectedEventId(event.id)}>
                        {t("common:view")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DataTableFrame>

      {/* Detail sheet */}
      <Sheet open={Boolean(selectedEventId)} onOpenChange={(open) => !open && setSelectedEventId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl" aria-describedby="audit-sheet-desc">
          <SheetHeader className="pr-6">
            <SheetTitle className="font-bold text-slate-900">{t("audit:activityDetail")}</SheetTitle>
            <SheetDescription id="audit-sheet-desc">{t("audit:activityDetailDesc")}</SheetDescription>
          </SheetHeader>

          {selectedEvent && (
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 divide-y divide-slate-100">
                {[
                  { label: t("audit:timestamp"), value: formatHumanDateTime(selectedEvent.createdAt) },
                  { label: t("audit:market"), value: selectedEvent.marketName || t("audit:allMarkets") },
                  { label: t("audit:actor"), value: selectedEvent.actorName },
                  { label: t("audit:role"), value: <span className="capitalize font-semibold">{selectedEvent.actorRole}</span> },
                  { label: t("audit:action"), value: <span className="font-mono text-xs">{selectedEvent.action}</span> },
                  { label: t("audit:entity"), value: <span className="font-mono text-xs">{selectedEvent.entityType} #{selectedEvent.entityId}</span> },
                ].map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
                    <span className="text-slate-500">{row.label}</span>
                    <span className="font-semibold text-slate-900 text-right">{row.value}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">{t("audit:recordedDetails")}</p>
                <pre className="max-h-[400px] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs text-slate-700">
                  {selectedEvent.details ? JSON.stringify(selectedEvent.details, null, 2) : t("audit:noDetails")}
                </pre>
              </div>

              {/* Mobile close */}
              <div className="sticky bottom-0 border-t border-slate-200 bg-white pt-3 sm:hidden">
                <button type="button" onClick={() => setSelectedEventId(null)} className="flex h-11 w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold text-slate-900">
                  {t("common:close")}
                </button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </PageLayout>
  );
};

export default AuditPage;
