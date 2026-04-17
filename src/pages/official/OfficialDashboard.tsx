import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Landmark, ReceiptText, ShieldCheck, Users, Wallet } from "lucide-react";

import { api } from "@/lib/api";
import { formatCurrency, formatHumanDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type {
  AuditEvent,
  Market,
  Payment,
  Penalty,
  Ticket,
  UtilityCharge,
  UtilityType,
} from "@/types";

type RegionId = "central" | "western" | "eastern" | "northern";
type MarketStatus = "Healthy" | "Warning" | "Critical";

const regions: Array<{
  id: RegionId;
  name: string;
  description: string;
  path: string;
  label: { x: number; y: number };
}> = [
  {
    id: "northern",
    name: "Northern",
    description: "Northern Uganda market corridor",
    path: "M85 30 L170 24 L226 82 L174 106 L116 116 L52 94 Z",
    label: { x: 135, y: 70 },
  },
  {
    id: "western",
    name: "Western",
    description: "Western and south-western markets",
    path: "M52 94 L116 116 L94 156 L124 188 L89 226 L45 196 L30 142 Z",
    label: { x: 76, y: 162 },
  },
  {
    id: "central",
    name: "Central",
    description: "Central region and Kampala belt",
    path: "M116 116 L174 106 L198 138 L178 180 L124 188 L94 156 Z",
    label: { x: 145, y: 150 },
  },
  {
    id: "eastern",
    name: "Eastern",
    description: "Eastern trade and border markets",
    path: "M174 106 L226 82 L258 126 L242 178 L178 180 L198 138 Z",
    label: { x: 218, y: 141 },
  },
];

const regionKeywords: Record<RegionId, string[]> = {
  central: ["kampala", "central", "wakiso", "mukono", "masaka", "mityana", "mpigi", "luwero", "kayunga", "mubende", "testbed", "demo"],
  western: ["western", "mbarara", "fort portal", "hoima", "kabale", "kasese", "masindi", "bushenyi", "ntungamo", "ibanda"],
  eastern: ["eastern", "jinja", "mbale", "tororo", "soroti", "iganga", "busia", "pallisa", "kapchorwa", "jin"],
  northern: ["northern", "gulu", "lira", "arua", "kitgum", "moroto", "nebbi", "adjumani", "apac"],
};

const utilityLabels: Record<UtilityType, string> = {
  electricity: "Electricity",
  water: "Water",
  sanitation: "Sanitation",
  garbage: "Garbage",
  other: "Utility",
};

const riskStatuses = new Set(["unpaid", "pending", "pending_payment", "overdue"]);

const getMarketRegion = (market: Market): RegionId => {
  const value = `${market.name} ${market.code} ${market.location}`.toLowerCase();
  const match = regions.find((region) => regionKeywords[region.id].some((keyword) => value.includes(keyword)));
  return match?.id || "central";
};

const getMarketStatus = ({
  utilitiesDue,
  penalties,
  complaints,
  overdue,
}: {
  utilitiesDue: number;
  penalties: number;
  complaints: number;
  overdue: number;
}): MarketStatus => {
  if (overdue >= 3 || penalties >= 3 || complaints >= 5 || utilitiesDue >= 2_000_000) return "Critical";
  if (overdue > 0 || penalties > 0 || complaints > 0 || utilitiesDue > 0) return "Warning";
  return "Healthy";
};

const statusClassName = (status: MarketStatus) => {
  if (status === "Healthy") return "status-badge border-success/20 bg-success/15 text-success";
  if (status === "Warning") return "status-badge border-warning/25 bg-warning/15 text-warning";
  return "status-badge border-destructive/20 bg-destructive/15 text-destructive";
};

const getPaymentReference = (payment: Payment) =>
  payment.providerReference || payment.transactionId || payment.externalReference || "Awaiting reference";

const formatAction = (action: string) => action.replaceAll("_", " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());

const OfficialDashboard = () => {
  const [selectedRegion, setSelectedRegion] = useState<RegionId>("central");

  const { data: marketsData } = useQuery({
    queryKey: ["markets", "official"],
    queryFn: () => api.getMarkets(),
  });
  const { data: stallsData } = useQuery({
    queryKey: ["stalls", "official", "all"],
    queryFn: () => api.getStalls(),
  });
  const { data: vendorsData } = useQuery({
    queryKey: ["vendors", "official", "all"],
    queryFn: () => api.getVendors(),
  });
  const { data: paymentsData } = useQuery({
    queryKey: ["payments", "official", "all"],
    queryFn: () => api.getPayments(),
  });
  const { data: ticketsData } = useQuery({
    queryKey: ["tickets", "official", "all"],
    queryFn: () => api.getTickets(),
  });
  const { data: bookingsData } = useQuery({
    queryKey: ["bookings", "official", "all"],
    queryFn: () => api.getBookings(),
  });
  const { data: utilityChargesData } = useQuery({
    queryKey: ["utility-charges", "official", "all"],
    queryFn: () => api.getUtilityCharges(),
  });
  const { data: penaltiesData } = useQuery({
    queryKey: ["penalties", "official", "all"],
    queryFn: () => api.getPenalties(),
  });
  const { data: auditData } = useQuery({
    queryKey: ["audit", "official-dashboard", "all"],
    queryFn: () => api.getAudit(),
  });

  const markets = marketsData?.markets || [];
  const stalls = stallsData?.stalls || [];
  const vendors = vendorsData?.vendors || [];
  const payments = paymentsData?.payments || [];
  const tickets = ticketsData?.tickets || [];
  const bookings = bookingsData?.bookings || [];
  const utilityCharges = utilityChargesData?.utilityCharges || [];
  const penalties = penaltiesData?.penalties || [];
  const auditEvents = auditData?.events || [];

  const selectedRegionInfo = regions.find((region) => region.id === selectedRegion)!;
  const regionMarkets = markets.filter((market) => getMarketRegion(market) === selectedRegion);
  const regionMarketIds = new Set(regionMarkets.map((market) => market.id));
  const inRegion = (marketId: string | null | undefined) => Boolean(marketId && regionMarketIds.has(marketId));

  const regionVendors = vendors.filter((vendor) => inRegion(vendor.marketId));
  const regionStalls = stalls.filter((stall) => inRegion(stall.marketId));
  const regionPayments = payments.filter((payment) => inRegion(payment.marketId));
  const regionTickets = tickets.filter((ticket) => inRegion(ticket.marketId));
  const regionBookings = bookings.filter((booking) => inRegion(booking.marketId));
  const regionUtilities = utilityCharges.filter((charge) => inRegion(charge.marketId));
  const regionPenalties = penalties.filter((penalty) => inRegion(penalty.marketId));
  const regionAuditEvents = auditEvents.filter((event) => inRegion(event.marketId));

  const completedPayments = regionPayments.filter((payment) => payment.status === "completed");
  const regionalRevenue = completedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const regionalUtilityDue = regionUtilities
    .filter((charge) => riskStatuses.has(charge.status))
    .reduce((sum, charge) => sum + charge.amount, 0);
  const regionalOverdueCount =
    regionUtilities.filter((charge) => charge.status === "overdue").length +
    regionPenalties.filter((penalty) => penalty.status === "unpaid" || penalty.status === "pending" || penalty.status === "pending_payment").length;
  const regionalComplianceAlerts =
    regionTickets.filter((ticket) => ticket.status !== "resolved").length +
    regionUtilities.filter((charge) => charge.status === "overdue").length +
    regionPenalties.filter((penalty) => penalty.status === "unpaid" || penalty.status === "pending" || penalty.status === "pending_payment").length;

  const paidByBooking = regionPayments.reduce<Record<string, number>>((accumulator, payment) => {
    if (payment.status === "completed" && payment.bookingId) {
      accumulator[payment.bookingId] = (accumulator[payment.bookingId] || 0) + payment.amount;
    }
    return accumulator;
  }, {});

  const marketRows = regionMarkets.map((market) => {
    const marketVendors = vendors.filter((vendor) => vendor.marketId === market.id);
    const marketPayments = payments.filter((payment) => payment.marketId === market.id && payment.status === "completed");
    const marketUtilities = utilityCharges.filter((charge) => charge.marketId === market.id);
    const marketPenalties = penalties.filter((penalty) => penalty.marketId === market.id);
    const marketComplaints = tickets.filter((ticket) => ticket.marketId === market.id && ticket.status !== "resolved");
    const utilitiesDue = marketUtilities
      .filter((charge) => riskStatuses.has(charge.status))
      .reduce((sum, charge) => sum + charge.amount, 0);
    const openPenalties = marketPenalties.filter((penalty) => penalty.status === "unpaid" || penalty.status === "pending" || penalty.status === "pending_payment").length;
    const overdue = marketUtilities.filter((charge) => charge.status === "overdue").length + openPenalties;
    const revenue = marketPayments.reduce((sum, payment) => sum + payment.amount, 0);

    return {
      id: market.id,
      name: market.name,
      vendors: marketVendors.length || market.vendorCount,
      revenue,
      utilitiesDue,
      penalties: openPenalties,
      complaints: marketComplaints.length,
      status: getMarketStatus({ utilitiesDue, penalties: openPenalties, complaints: marketComplaints.length, overdue }),
    };
  });

  const overdueRows = [
    ...regionUtilities
      .filter((charge) => charge.status === "overdue")
      .map((charge) => ({
        id: `utility-${charge.id}`,
        vendor: charge.vendorName,
        market: charge.marketName || "Assigned market",
        amount: charge.amount,
        detail: `${utilityLabels[charge.utilityType]} overdue`,
      })),
    ...regionBookings
      .filter((booking) => ["approved", "paid"].includes(booking.status))
      .map((booking) => ({
        id: `booking-${booking.id}`,
        vendor: booking.vendorName,
        market: booking.marketName || "Assigned market",
        amount: Math.max(booking.amount - (paidByBooking[booking.id] || 0), 0),
        detail: `Stall ${booking.stallName}`,
      }))
      .filter((row) => row.amount > 0 && new Date(bookingEndDateById(regionBookings, row.id)).getTime() < Date.now()),
  ].slice(0, 6);

  const utilityRows = regionUtilities
    .filter((charge) => riskStatuses.has(charge.status))
    .sort((left, right) => {
      const weight: Record<UtilityCharge["status"], number> = {
        overdue: 0,
        unpaid: 1,
        pending: 2,
        pending_payment: 2,
        paid: 3,
        cancelled: 4,
      };
      return weight[left.status] - weight[right.status];
    })
    .slice(0, 6);

  const penaltyRows = regionPenalties
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 6);

  const recentAuditRows = regionAuditEvents
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 8);

  const paymentCompletionRate = regionPayments.length
    ? Math.round((regionPayments.filter((payment) => payment.status === "completed").length / regionPayments.length) * 100)
    : 0;
  const occupancyRate = regionStalls.length
    ? Math.round((regionStalls.filter((stall) => stall.status === "active").length / regionStalls.length) * 100)
    : 0;

  const summaryCards = [
    { label: "Markets", value: regionMarkets.length.toLocaleString(), icon: Landmark },
    { label: "Vendors", value: regionVendors.length.toLocaleString(), icon: Users },
    { label: "Revenue", value: formatCurrency(regionalRevenue), icon: Wallet },
    { label: "Unpaid Utilities", value: formatCurrency(regionalUtilityDue), icon: ReceiptText },
    { label: "Overdue Payments", value: regionalOverdueCount.toLocaleString(), icon: AlertCircle },
    { label: "Compliance Alerts", value: regionalComplianceAlerts.toLocaleString(), icon: ShieldCheck },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border/80 bg-card p-5 shadow-sm lg:p-6">
        <h1 className="text-2xl font-bold font-heading lg:text-3xl">National Market Oversight</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Monitor market performance, compliance, and financial activity across regions.
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1.05fr]">
        <Card className="card-warm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Uganda Regional Map</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <svg viewBox="0 0 288 256" role="img" aria-label="Uganda region selection map" className="h-[320px] w-full">
              <path
                d="M85 30 L170 24 L226 82 L258 126 L242 178 L178 180 L124 188 L89 226 L45 196 L30 142 L52 94 Z"
                fill="hsl(var(--muted) / 0.28)"
                stroke="hsl(var(--border))"
                strokeWidth="2"
              />
              {regions.map((region) => {
                const selected = selectedRegion === region.id;
                return (
                  <g key={region.id}>
                    <path
                      d={region.path}
                      role="button"
                      tabIndex={0}
                      aria-label={`Filter dashboard to ${region.name} region`}
                      onClick={() => setSelectedRegion(region.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedRegion(region.id);
                        }
                      }}
                      fill={selected ? "hsl(var(--primary) / 0.22)" : "hsl(var(--muted) / 0.58)"}
                      stroke={selected ? "hsl(var(--primary))" : "hsl(var(--border))"}
                      strokeWidth={selected ? 2.4 : 1.4}
                      opacity={selected ? 1 : 0.44}
                      className="cursor-pointer transition-opacity hover:opacity-100 focus:outline-none"
                    />
                    <text
                      x={region.label.x}
                      y={region.label.y}
                      textAnchor="middle"
                      className="pointer-events-none fill-foreground text-[10px] font-semibold"
                    >
                      {region.name}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div className="flex flex-wrap gap-2">
              {regions.map((region) => (
                <button
                  key={region.id}
                  type="button"
                  onClick={() => setSelectedRegion(region.id)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedRegion === region.id
                      ? "border-foreground/25 bg-foreground text-background"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {region.name}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="card-warm">
          <CardHeader className="pb-3">
            <div>
              <CardTitle className="text-base font-heading">{selectedRegionInfo.name} Region</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{selectedRegionInfo.description}</p>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {summaryCards.map((item) => (
              <div key={item.label} className="rounded-lg border border-border/70 bg-muted/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="mt-1 text-lg font-bold font-heading">{item.value}</p>
                  </div>
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card className="card-warm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Markets in Selected Region</CardTitle>
        </CardHeader>
        <CardContent>
          {marketRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No markets are registered in this region yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Market</TableHead>
                  <TableHead className="text-right">Vendors</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Utilities Due</TableHead>
                  <TableHead className="text-right">Penalties</TableHead>
                  <TableHead className="text-right">Complaints</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {marketRows.map((market) => (
                  <TableRow key={market.id}>
                    <TableCell className="font-medium">{market.name}</TableCell>
                    <TableCell className="text-right">{market.vendors}</TableCell>
                    <TableCell className="text-right">{formatCurrency(market.revenue)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(market.utilitiesDue)}</TableCell>
                    <TableCell className="text-right">{market.penalties}</TableCell>
                    <TableCell className="text-right">{market.complaints}</TableCell>
                    <TableCell><span className={statusClassName(market.status)}>{market.status}</span></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="card-warm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Overdue Payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {overdueRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No overdue payment records in this region.</p>
            ) : (
              overdueRows.map((row) => (
                <div key={row.id} className="rounded-lg border border-border/70 bg-muted/15 p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{row.vendor}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{row.detail} - {row.market}</p>
                    </div>
                    <p className="font-semibold">{formatCurrency(row.amount)}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="card-warm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Unpaid Utilities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {utilityRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No unpaid utility charges in this region.</p>
            ) : (
              utilityRows.map((charge) => (
                <div key={charge.id} className="rounded-lg border border-border/70 bg-muted/15 p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{utilityLabels[charge.utilityType]}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{charge.vendorName} - {charge.marketName || "Assigned market"}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(charge.amount)}</p>
                      <StatusBadge status={charge.status} context="obligation" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="card-warm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Penalties Issued</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {penaltyRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No penalties are recorded in this region.</p>
            ) : (
              penaltyRows.map((penalty) => (
                <div key={penalty.id} className="rounded-lg border border-border/70 bg-muted/15 p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{penalty.vendorName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{penalty.reason}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(penalty.amount)}</p>
                      <StatusBadge status={penalty.status} context="obligation" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="card-warm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Recent Audit Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentAuditRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No audit activity is available for this region yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Market</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentAuditRows.map((event: AuditEvent) => (
                  <TableRow key={event.id}>
                    <TableCell className="text-muted-foreground">{formatHumanDateTime(event.createdAt)}</TableCell>
                    <TableCell className="font-medium">{formatAction(event.action)}</TableCell>
                    <TableCell>{event.actorName}</TableCell>
                    <TableCell className="text-muted-foreground">{event.marketName || "Region scope"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="card-warm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Payment Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Completed payments in selected region</p>
                  <p className="mt-1 text-3xl font-bold font-heading">{paymentCompletionRate}%</p>
                </div>
                <p className="text-sm text-muted-foreground">{regionPayments.length} total payment records</p>
              </div>
              <div className="mt-4 h-2 rounded-full bg-muted">
                <div className="h-full rounded-full bg-success" style={{ width: `${paymentCompletionRate}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-warm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Regional Occupancy Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Active stalls in selected region</p>
                  <p className="mt-1 text-3xl font-bold font-heading">{occupancyRate}%</p>
                </div>
                <p className="text-sm text-muted-foreground">{regionStalls.length} total stalls</p>
              </div>
              <div className="mt-4 h-2 rounded-full bg-muted">
                <div className="h-full rounded-full bg-foreground" style={{ width: `${occupancyRate}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

const bookingEndDateById = (bookings: Array<{ id: string; endDate: string }>, rowId: string) => {
  const bookingId = rowId.replace("booking-", "");
  return bookings.find((booking) => booking.id === bookingId)?.endDate || "";
};

export default OfficialDashboard;
