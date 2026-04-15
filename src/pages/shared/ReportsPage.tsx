import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
    auditSummary.variance === 0 ? "text-success" : auditSummary.variance > 0 ? "text-warning" : "text-destructive";
  const variancePanelClass =
    auditSummary.variance === 0
      ? "border-success/30 bg-success/5 text-success"
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
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading">Reports</h1>
          <p className="text-muted-foreground text-sm mt-1">Revenue, outstanding dues, and financial reconciliation</p>
        </div>
        <Button onClick={exportCSV} variant="outline">
          <Download className="w-4 h-4 mr-1" />
          Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="w-40" />
        </div>
        {canScopeMarkets && (
          <div className="space-y-1">
            <Label className="text-xs">Market</Label>
            <Select value={selectedMarketId} onValueChange={setSelectedMarketId}>
              <SelectTrigger className="w-[220px]">
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
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card className="card-warm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Revenue</p>
            <p className="text-xl font-bold font-heading text-success mt-1">{formatCurrency(revenueReport?.summary.totalRevenue || 0)}</p>
          </CardContent>
        </Card>
        <Card className="card-warm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Outstanding Dues</p>
            <p className="text-xl font-bold font-heading text-warning mt-1">{formatCurrency(duesReport?.summary.outstandingTotal || 0)}</p>
          </CardContent>
        </Card>
        <Card className="card-warm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Transactions</p>
            <p className="text-xl font-bold font-heading mt-1">{revenueReport?.summary.transactionCount || 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="card-warm border-warning/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Financial Audit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-muted/40 p-4">
              <p className="text-xs text-muted-foreground">Collected Total</p>
              <p className="mt-1 text-xl font-bold font-heading text-success">{formatCurrency(auditSummary.collectedTotal)}</p>
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
                    <TableCell className="capitalize">{row.status}</TableCell>
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
                    <TableCell className="text-warning">{formatCurrency(row.outstandingAmount)}</TableCell>
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
    </div>
  );
};

export default ReportsPage;
