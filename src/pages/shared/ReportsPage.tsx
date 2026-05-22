import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, Eye, XCircle } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatHumanDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConsolePage, DataTableFrame, EmptyState, PageHeader, ScopeBar, ScopeItem } from "@/components/console/ConsolePage";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import type { Payment } from "@/types";

const paymentStatus = (status: Payment["status"] | "all") =>
  status === "completed" ? "Verified" : status === "failed" ? "Rejected" : status === "pending" ? "Pending" : "All";

const ReportsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dateFrom, setDateFrom] = useState("2026-01-01");
  const [dateTo, setDateTo] = useState("2026-12-31");
  const [selectedMarketId, setSelectedMarketId] = useState("all");
  const [statusFilter, setStatusFilter] = useState<Payment["status"] | "all">("all");
  const [rejectionPayment, setRejectionPayment] = useState<Payment | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const canScopeMarkets = user?.role === "official" || user?.role === "admin";
  const marketId = canScopeMarkets && selectedMarketId !== "all" ? selectedMarketId : undefined;

  const { data: marketsData } = useQuery({
    queryKey: ["markets", "reports"],
    queryFn: () => api.getMarkets(),
    enabled: canScopeMarkets,
  });
  const paymentsQuery = useQuery({
    queryKey: ["payments", "reports", marketId || "all"],
    queryFn: () => api.getPayments(marketId),
  });

  const reviewReceipt = useMutation({
    mutationFn: ({ payment, status, reason }: { payment: Payment; status: "verified" | "rejected"; reason?: string }) =>
      api.verifyPaymentReceipt(payment.id, { status, reason }),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast.success(variables.status === "verified" ? "Receipt verified" : "Receipt rejected");
      setRejectionPayment(null);
      setRejectionReason("");
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : "Unable to review receipt.";
      toast.error("Receipt review failed", { description: message });
    },
  });

  const payments = (paymentsQuery.data?.payments || []).filter((payment) => {
    const created = new Date(payment.createdAt);
    const fromOk = !dateFrom || created >= new Date(`${dateFrom}T00:00:00`);
    const toOk = !dateTo || created <= new Date(`${dateTo}T23:59:59`);
    const statusOk = statusFilter === "all" || payment.status === statusFilter;
    return fromOk && toOk && statusOk;
  });

  const openReceipt = async (payment: Payment) => {
    try {
      const url = await api.getReceiptFileUrl(payment.id);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Unable to open receipt image.";
      toast.error("Receipt unavailable", { description: message });
    }
  };

  const exportCSV = () => {
    const header = "Vendor,Amount,Receipt Number,Verification Status,Submitted Date,Market\n";
    const rows = payments
      .map((payment) =>
        [
          payment.vendorName,
          payment.amount,
          payment.receiptId || payment.externalReference,
          paymentStatus(payment.status),
          payment.createdAt,
          payment.marketName || "",
        ].join(","),
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `payment_reconciliation_${dateFrom}_${dateTo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV export started");
  };

  return (
    <ConsolePage>
      <PageHeader
        eyebrow="Reports and reconciliation"
        title="Reports & Reconciliation"
        description="Receipt submissions, verification status, and exportable payment records."
        actions={
          <Button onClick={exportCSV} variant="outline">
            <Download className="mr-1 h-4 w-4" />
            Export CSV
          </Button>
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
                  <SelectItem key={market.id} value={market.id}>{market.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ScopeItem>
        )}
        <ScopeItem label="Status" className="w-full sm:w-[180px]">
          <Select value={statusFilter} onValueChange={(value: Payment["status"] | "all") => setStatusFilter(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Verified</SelectItem>
              <SelectItem value="failed">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </ScopeItem>
      </ScopeBar>

      <DataTableFrame title="Payment Records">
        {payments.length === 0 ? (
          <div className="p-3">
            <EmptyState title="No transactions recorded" description="Receipt submissions matching the selected filters will appear here." />
          </div>
        ) : (
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
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium">{payment.vendorName}</TableCell>
                  <TableCell>{payment.amount > 0 ? formatCurrency(payment.amount) : "No payments due"}</TableCell>
                  <TableCell className="font-medium">{payment.receiptId || payment.externalReference}</TableCell>
                  <TableCell>
                    {payment.receiptFileName ? (
                      <Button variant="outline" size="sm" onClick={() => openReceipt(payment)}>
                        <Eye className="mr-1 h-4 w-4" />
                        View
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">No receipt uploaded</span>
                    )}
                  </TableCell>
                  <TableCell><StatusBadge status={payment.status} context="payment" /></TableCell>
                  <TableCell className="text-muted-foreground">{formatHumanDateTime(payment.createdAt)}</TableCell>
                  <TableCell>
                    {payment.status === "pending" && payment.receiptFileName ? (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => reviewReceipt.mutate({ payment, status: "verified" })} disabled={reviewReceipt.isPending}>
                          <CheckCircle2 className="mr-1 h-4 w-4" />
                          Verify
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setRejectionPayment(payment)} disabled={reviewReceipt.isPending}>
                          <XCircle className="mr-1 h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Reviewed</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataTableFrame>

      <Dialog open={Boolean(rejectionPayment)} onOpenChange={(open) => !open && setRejectionPayment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Reject Receipt</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder="Reason, for example unreadable receipt image"
            />
            <Button
              className="w-full"
              disabled={!rejectionReason.trim() || reviewReceipt.isPending || !rejectionPayment}
              onClick={() => rejectionPayment && reviewReceipt.mutate({ payment: rejectionPayment, status: "rejected", reason: rejectionReason })}
            >
              Reject Receipt
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ConsolePage>
  );
};

export default ReportsPage;
