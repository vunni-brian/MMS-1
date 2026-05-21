import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ConsolePage, DataTableFrame, EmptyState, PageHeader, ScopeBar, ScopeItem } from "@/components/console/ConsolePage";
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

  const verificationStatus = (status: string) => {
    if (status === "completed") return "Verified";
    if (status === "failed") return "Rejected";
    return "Pending";
  };

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

  return (
    <ConsolePage>
      <PageHeader
        eyebrow="Reports and reconciliation"
        title="Reports & Reconciliation"
        description="Review submitted receipts and verify payment records."
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
      </ScopeBar>

      <DataTableFrame title="Payment Records">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Receipt Number</TableHead>
                  <TableHead>Receipt Image</TableHead>
                  <TableHead>Verification Status</TableHead>
                  <TableHead>Submitted Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(revenueReport?.rows || []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.vendorName}</TableCell>
                    <TableCell>{formatCurrency(row.amount)}</TableCell>
                    <TableCell className="font-medium">{row.reference || `RCPT-${row.id.slice(0, 6).toUpperCase()}`}</TableCell>
                    <TableCell><Button variant="ghost" size="sm">Download</Button></TableCell>
                    <TableCell><StatusBadge status={verificationStatus(row.status)} label={verificationStatus(row.status)} context="payment" /></TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(row.createdAt)}</TableCell>
                    <TableCell className="space-x-2"><Button size="sm" variant="outline">Verify</Button><Button size="sm" variant="ghost">Reject</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
      </DataTableFrame>

      <DataTableFrame title="Outstanding Dues">
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
                    <TableCell>{row.outstandingAmount > 0 ? formatCurrency(row.outstandingAmount) : "No payments due"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
      </DataTableFrame>
      {(revenueReport?.rows || []).length === 0 && (
        <EmptyState title="No transactions recorded" description="Try adjusting filters to locate submitted receipts." />
      )}
    </ConsolePage>
  );
};

export default ReportsPage;
