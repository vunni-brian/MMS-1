import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, Download, ReceiptText, Wallet } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConsolePage, KpiStrip, PageHeader, ScopeBar, ScopeItem } from "@/components/console/ConsolePage";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";

const formatCurrency = (value: number) => `UGX ${value.toLocaleString()}`;
const formatDateTime = (value: string) => new Date(value).toLocaleString();

const ReportsPage = () => {
  const { user } = useAuth();
  const [dateFrom, setDateFrom] = useState("2026-01-01");
  const [dateTo, setDateTo] = useState("2026-12-31");
  const [selectedMarketId, setSelectedMarketId] = useState("all");
  const canScopeMarkets = user?.role === "official" || user?.role === "admin";
  const marketId = canScopeMarkets && selectedMarketId !== "all" ? selectedMarketId : undefined;
  const { data: marketsData } = useQuery({
    queryKey: ["markets", "reports"],
    queryFn: () => api.getMarkets(),
    enabled: canScopeMarkets,
  });
  const { data: revenueReport } = useQuery({
    queryKey: ["reports", "revenue", dateFrom, dateTo, marketId || "all"],
    queryFn: () => api.getRevenueReport(dateFrom, dateTo, marketId),
  });
  const { data: duesReport } = useQuery({
    queryKey: ["reports", "dues", dateFrom, dateTo, marketId || "all"],
    queryFn: () => api.getDuesReport(dateFrom, dateTo, marketId),
  });
  const { data: financialAuditReport } = useQuery({
    queryKey: ["reports", "financial-audit", dateFrom, dateTo, marketId || "all"],
    queryFn: () => api.getFinancialAudit(dateFrom, dateTo, marketId),
  });

  const auditSummary = financialAuditReport?.summary || {
    collectedTotal: 0,
    depositedTotal: 0,
    variance: 0,
  };
  const varianceToneClass =
    auditSummary.variance === 0 ? "text-foreground" : auditSummary.variance > 0 ? "text-warning" : "text-destructive";
  const variancePanelClass =
    auditSummary.variance === 0
      ? "border-border/70 bg-muted/20 text-muted-foreground"
      : auditSummary.variance > 0
        ? "border-warning/30 bg-warning/5 text-warning"
        : "border-destructive/30 bg-destructive/5 text-destructive";
  const varianceMessage =
    auditSummary.variance === 0
      ? "Collections and recorded bank deposits are balanced for the selected period."
      : auditSummary.variance > 0
        ? `Collections exceed recorded deposits by ${formatCurrency(auditSummary.variance)}.`
        : `Recorded deposits exceed collections by ${formatCurrency(Math.abs(auditSummary.variance))}.`;

  const exportCSV = () => {
    const header = "Date,Market,Vendor,Amount,Method,Transaction ID,Status\n";
    const rows = (revenueReport?.rows || [])
      .map((row) => `${row.createdAt},${row.marketName || ""},${row.vendorName},${row.amount},${row.method},${row.transactionId || ""},${row.status}`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `revenue_report_${dateFrom}_${dateTo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV export started", {
      description: "Revenue rows for the selected period are being downloaded.",
    });
  };
  const reportKpis = [
    {
      label: "Total Revenue",
      value: formatCurrency(revenueReport?.summary.totalRevenue || 0),
      detail: "Completed payments in selected period",
      icon: Wallet,
      tone: "success" as const,
    },
    {
      label: "Outstanding Dues",
      value: formatCurrency(duesReport?.summary.outstandingTotal || 0),
      detail: "Unsettled booking obligations",
      icon: AlertTriangle,
      tone: (duesReport?.summary.outstandingTotal || 0) > 0 ? "warning" as const : "success" as const,
    },
    {
      label: "Transactions",
      value: revenueReport?.summary.transactionCount || 0,
      detail: "Payment rows in scope",
      icon: ReceiptText,
      tone: "info" as const,
    },
    {
      label: "Audit Variance",
      value: formatCurrency(auditSummary.variance),
      detail: "Collected vs deposited",
      icon: BarChart3,
      tone: auditSummary.variance === 0 ? "success" as const : "destructive" as const,
    },
  ];

  return (
    <ConsolePage>
      <PageHeader
        eyebrow="Reports and reconciliation"
        title="Reports"
        description="Review revenue, outstanding dues, bank deposits, and payment evidence by date and market scope."
        actions={
          <Button onClick={exportCSV} variant="outline">
          <Download className="w-4 h-4 mr-1" />
          Export CSV
          </Button>
        }
        meta={
          <>
            <span className="rounded-full bg-muted px-2.5 py-1">From {dateFrom}</span>
            <span className="rounded-full bg-muted px-2.5 py-1">To {dateTo}</span>
          </>
        }
      />

      <ScopeBar>
        <ScopeItem label="From">
          <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="w-40" />
        </ScopeItem>
        <ScopeItem label="To">
          <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="w-40" />
        </ScopeItem>
        {canScopeMarkets && (
          <ScopeItem label="Market" className="w-full sm:w-[240px]">
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
          <div className="rounded-md border border-border/70 bg-background px-3 py-2 text-sm">Use confirmed gateway status for revenue</div>
        </ScopeItem>
      </ScopeBar>

      <KpiStrip items={reportKpis} />

      <Card className="card-warm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Financial Audit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-muted/40 p-4">
              <p className="text-xs text-muted-foreground">Collected Total</p>
              <p className="mt-1 text-xl font-bold font-heading">{formatCurrency(auditSummary.collectedTotal)}</p>
            </div>
            <div className="rounded-xl bg-muted/40 p-4">
              <p className="text-xs text-muted-foreground">Deposited Total</p>
              <p className="mt-1 text-xl font-bold font-heading">{formatCurrency(auditSummary.depositedTotal)}</p>
            </div>
            <div className="rounded-xl bg-muted/40 p-4">
              <p className="text-xs text-muted-foreground">Variance</p>
              <p className={`mt-1 text-xl font-bold font-heading ${varianceToneClass}`}>{formatCurrency(auditSummary.variance)}</p>
            </div>
          </div>
          <div className={`rounded-xl border px-4 py-3 text-sm ${variancePanelClass}`}>{varianceMessage}</div>
        </CardContent>
      </Card>

      <Card className="card-warm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Payment Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Market</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(revenueReport?.rows || []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-muted-foreground">{formatDateTime(row.createdAt)}</TableCell>
                    <TableCell>{row.marketName || "Unassigned"}</TableCell>
                    <TableCell className="font-medium">{row.vendorName}</TableCell>
                    <TableCell>{formatCurrency(row.amount)}</TableCell>
                    <TableCell>{row.method.toUpperCase()}</TableCell>
                    <TableCell className="font-mono text-xs">{row.transactionId || "Awaiting confirmation"}</TableCell>
                    <TableCell><StatusBadge status={row.status} context="payment" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="card-warm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Outstanding Dues</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Market</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Stall</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(duesReport?.rows || []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.marketName || "Unassigned"}</TableCell>
                    <TableCell className="font-medium">{row.vendorName}</TableCell>
                    <TableCell>{row.stallName}</TableCell>
                    <TableCell>{formatCurrency(row.amount)}</TableCell>
                    <TableCell>{formatCurrency(row.paidAmount)}</TableCell>
                    <TableCell>{formatCurrency(row.outstandingAmount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="card-warm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Bank Deposits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Market</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Deposited At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(financialAuditReport?.rows || []).length > 0 ? (
                  (financialAuditReport?.rows || []).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.marketName || "Unassigned"}</TableCell>
                      <TableCell className="font-medium">{row.reference}</TableCell>
                      <TableCell>{formatCurrency(row.amount)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(row.depositedAt)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      No bank deposits were recorded for the selected filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </ConsolePage>
  );
};

export default ReportsPage;
