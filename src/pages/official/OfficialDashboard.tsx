import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Landmark,
  ReceiptText,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";

import { api } from "@/lib/api";
import { formatCurrency, formatHumanDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, LoadingState } from "@/components/console/ConsolePage";
import type {
  Market,
  Payment,
  Penalty,
  Ticket,
  UtilityCharge,
  UtilityType,
} from "@/types";

type RegionId = "central" | "western" | "eastern" | "northern";
type MarketStatus = "Healthy" | "Warning" | "Critical";

interface SubAreaOption {
  id: string;
  name: string;
  type: string;
  keywords: string[];
}

interface AreaOption {
  id: string;
  regionId: RegionId;
  name: string;
  type: string;
  keywords: string[];
  subAreas: SubAreaOption[];
}

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
  central: [
    "kampala",
    "central",
    "wakiso",
    "mukono",
    "masaka",
    "mityana",
    "mpigi",
    "luwero",
    "kayunga",
    "mubende",
    "testbed",
    "demo",
  ],
  western: [
    "western",
    "mbarara",
    "fort portal",
    "hoima",
    "kabale",
    "kasese",
    "masindi",
    "bushenyi",
    "ntungamo",
    "ibanda",
  ],
  eastern: [
    "eastern",
    "jinja",
    "mbale",
    "tororo",
    "soroti",
    "iganga",
    "busia",
    "pallisa",
    "kapchorwa",
    "jin",
  ],
  northern: [
    "northern",
    "gulu",
    "lira",
    "arua",
    "kitgum",
    "moroto",
    "nebbi",
    "adjumani",
    "apac",
  ],
};

const locationAreas: AreaOption[] = [
  {
    id: "loc_area_kampala",
    regionId: "central",
    name: "Kampala",
    type: "City",
    keywords: ["kampala", "testbed", "demo"],
    subAreas: [
      { id: "loc_subarea_kampala_central", name: "Central Division", type: "Division", keywords: ["central", "kla-central"] },
      { id: "loc_subarea_kampala_kawempe", name: "Kawempe Division", type: "Division", keywords: ["kawempe"] },
      { id: "loc_subarea_kampala_nakawa", name: "Nakawa Division", type: "Division", keywords: ["nakawa"] },
      { id: "loc_subarea_kampala_rubaga", name: "Rubaga Division", type: "Division", keywords: ["rubaga"] },
      { id: "loc_subarea_kampala_makindye", name: "Makindye Division", type: "Division", keywords: ["makindye"] },
      { id: "loc_subarea_testbed", name: "MMS Testbed", type: "Subcounty", keywords: ["testbed", "demo"] },
    ],
  },
  {
    id: "loc_area_wakiso",
    regionId: "central",
    name: "Wakiso",
    type: "District",
    keywords: ["wakiso"],
    subAreas: [],
  },
  {
    id: "loc_area_mukono",
    regionId: "central",
    name: "Mukono",
    type: "District",
    keywords: ["mukono"],
    subAreas: [],
  },
  {
    id: "loc_area_jinja",
    regionId: "eastern",
    name: "Jinja",
    type: "City",
    keywords: ["jinja", "jin-main"],
    subAreas: [
      { id: "loc_subarea_jinja_municipality", name: "Jinja Municipality", type: "Municipality", keywords: ["jinja", "jin-main"] },
    ],
  },
  {
    id: "loc_area_mbale",
    regionId: "eastern",
    name: "Mbale",
    type: "City",
    keywords: ["mbale"],
    subAreas: [],
  },
  {
    id: "loc_area_gulu",
    regionId: "northern",
    name: "Gulu",
    type: "City",
    keywords: ["gulu"],
    subAreas: [],
  },
  {
    id: "loc_area_mbarara",
    regionId: "western",
    name: "Mbarara",
    type: "City",
    keywords: ["mbarara"],
    subAreas: [],
  },
];

const utilityLabels: Record<UtilityType, string> = {
  electricity: "Electricity",
  water: "Water",
  sanitation: "Sanitation",
  garbage: "Garbage",
  other: "Utility",
};

const riskStatuses = new Set(["unpaid", "pending", "pending_payment", "overdue"]);

const getMarketSearchText = (market: Market) =>
  `${market.name} ${market.code} ${market.location} ${market.locationName || ""} ${market.subAreaName || ""} ${market.areaName || ""} ${market.regionName || ""}`.toLowerCase();

const getMarketRegion = (market: Market): RegionId => {
  const regionFromLocation = regions.find((region) => region.name === market.regionName);
  if (regionFromLocation) return regionFromLocation.id;

  const value = getMarketSearchText(market);
  const match = regions.find((region) =>
    regionKeywords[region.id].some((keyword) => value.includes(keyword)),
  );
  return match?.id || "central";
};

const getMarketAreaId = (market: Market) => {
  if (market.areaId) return market.areaId;

  const value = getMarketSearchText(market);
  const regionId = getMarketRegion(market);
  return (
    locationAreas
      .filter((area) => area.regionId === regionId)
      .find((area) => area.keywords.some((keyword) => value.includes(keyword)))?.id || null
  );
};

const getMarketSubAreaId = (market: Market) => {
  if (market.subAreaId) return market.subAreaId;

  const value = getMarketSearchText(market);
  const area = locationAreas.find((item) => item.id === getMarketAreaId(market));
  return area?.subAreas.find((subArea) => subArea.keywords.some((keyword) => value.includes(keyword)))?.id || null;
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
  if (overdue >= 3 || penalties >= 3 || complaints >= 5 || utilitiesDue >= 2_000_000) {
    return "Critical";
  }
  if (overdue > 0 || penalties > 0 || complaints > 0 || utilitiesDue > 0) {
    return "Warning";
  }
  return "Healthy";
};

const statusClassName = (status: MarketStatus) => {
  if (status === "Healthy") {
    return "status-badge border-success/20 bg-success/15 text-success";
  }
  if (status === "Warning") {
    return "status-badge border-warning/25 bg-warning/15 text-warning";
  }
  return "status-badge border-destructive/20 bg-destructive/15 text-destructive";
};

const bookingEndDateById = (bookings: Array<{ id: string; endDate: string }>, rowId: string) => {
  const bookingId = rowId.replace("booking-", "");
  return bookings.find((booking) => booking.id === bookingId)?.endDate || "";
};

const OfficialDashboard = () => {
  const [selectedRegion, setSelectedRegion] = useState<RegionId>("central");
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [selectedSubAreaId, setSelectedSubAreaId] = useState<string | null>(null);

  const { data: marketsData, isPending: marketsPending } = useQuery({
    queryKey: ["markets", "official"],
    queryFn: () => api.getMarkets(),
  });
  const { data: stallsData, isPending: stallsPending } = useQuery({
    queryKey: ["stalls", "official", "all"],
    queryFn: () => api.getStalls(),
  });
  const { data: vendorsData, isPending: vendorsPending } = useQuery({
    queryKey: ["vendors", "official", "all"],
    queryFn: () => api.getVendors(),
  });
  const { data: paymentsData, isPending: paymentsPending } = useQuery({
    queryKey: ["payments", "official", "all"],
    queryFn: () => api.getPayments(),
  });
  const { data: ticketsData, isPending: ticketsPending } = useQuery({
    queryKey: ["tickets", "official", "all"],
    queryFn: () => api.getTickets(),
  });
  const { data: bookingsData, isPending: bookingsPending } = useQuery({
    queryKey: ["bookings", "official", "all"],
    queryFn: () => api.getBookings(),
  });
  const { data: utilityChargesData, isPending: utilityChargesPending } = useQuery({
    queryKey: ["utility-charges", "official", "all"],
    queryFn: () => api.getUtilityCharges(),
  });
  const { data: penaltiesData, isPending: penaltiesPending } = useQuery({
    queryKey: ["penalties", "official", "all"],
    queryFn: () => api.getPenalties(),
  });

  const markets = marketsData?.markets || [];
  const stalls = stallsData?.stalls || [];
  const vendors = vendorsData?.vendors || [];
  const payments = paymentsData?.payments || [];
  const tickets = ticketsData?.tickets || [];
  const bookings = bookingsData?.bookings || [];
  const utilityCharges = utilityChargesData?.utilityCharges || [];
  const penalties = penaltiesData?.penalties || [];
  const isDashboardLoading =
    marketsPending ||
    stallsPending ||
    vendorsPending ||
    paymentsPending ||
    ticketsPending ||
    bookingsPending ||
    utilityChargesPending ||
    penaltiesPending;

  if (isDashboardLoading) {
    return (
      <div className="space-y-4 lg:space-y-5">
        <LoadingState rows={1} itemClassName="h-28 rounded-xl" />
        <LoadingState rows={2} className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]" itemClassName="h-[430px] rounded-xl" />
        <LoadingState rows={1} itemClassName="h-[320px] rounded-xl" />
        <LoadingState rows={2} className="grid gap-4 xl:grid-cols-2" itemClassName="h-[300px] rounded-xl" />
      </div>
    );
  }

  const selectedRegionInfo = regions.find((region) => region.id === selectedRegion)!;
  const selectedAreas = locationAreas.filter((area) => area.regionId === selectedRegion);
  const selectedArea = selectedAreas.find((area) => area.id === selectedAreaId) || null;
  const selectedSubAreas = selectedArea?.subAreas || [];
  const selectedSubArea = selectedSubAreas.find((subArea) => subArea.id === selectedSubAreaId) || null;
  const regionMarkets = markets.filter((market) => getMarketRegion(market) === selectedRegion);
  const scopedMarkets = regionMarkets.filter((market) => {
    if (selectedAreaId && getMarketAreaId(market) !== selectedAreaId) return false;
    if (selectedSubAreaId && getMarketSubAreaId(market) !== selectedSubAreaId) return false;
    return true;
  });
  const regionMarketIds = new Set(scopedMarkets.map((market) => market.id));
  const inRegion = (marketId: string | null | undefined) =>
    Boolean(marketId && regionMarketIds.has(marketId));
  const selectedScopeLabel = selectedSubArea?.name || selectedArea?.name || `${selectedRegionInfo.name} Region`;
  const selectRegion = (regionId: RegionId) => {
    setSelectedRegion(regionId);
    setSelectedAreaId(null);
    setSelectedSubAreaId(null);
  };

  const regionVendors = vendors.filter((vendor) => inRegion(vendor.marketId));
  const regionStalls = stalls.filter((stall) => inRegion(stall.marketId));
  const regionPayments = payments.filter((payment) => inRegion(payment.marketId));
  const regionTickets = tickets.filter((ticket) => inRegion(ticket.marketId));
  const regionBookings = bookings.filter((booking) => inRegion(booking.marketId));
  const regionUtilities = utilityCharges.filter((charge) => inRegion(charge.marketId));
  const regionPenalties = penalties.filter((penalty) => inRegion(penalty.marketId));

  const completedPayments = regionPayments.filter((payment) => payment.status === "completed");
  const regionalRevenue = completedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const regionalUtilityDue = regionUtilities
    .filter((charge) => riskStatuses.has(charge.status))
    .reduce((sum, charge) => sum + charge.amount, 0);
  const regionalOverdueCount =
    regionUtilities.filter((charge) => charge.status === "overdue").length +
    regionPenalties.filter((penalty) =>
      ["unpaid", "pending", "pending_payment"].includes(penalty.status),
    ).length;
  const regionalComplianceAlerts =
    regionTickets.filter((ticket) => ticket.status !== "resolved").length +
    regionUtilities.filter((charge) => charge.status === "overdue").length +
    regionPenalties.filter((penalty) =>
      ["unpaid", "pending", "pending_payment"].includes(penalty.status),
    ).length;

  const paidByBooking = regionPayments.reduce<Record<string, number>>((accumulator, payment) => {
    if (payment.status === "completed" && payment.bookingId) {
      accumulator[payment.bookingId] = (accumulator[payment.bookingId] || 0) + payment.amount;
    }
    return accumulator;
  }, {});

  const marketRows = scopedMarkets.map((market) => {
    const marketVendors = vendors.filter((vendor) => vendor.marketId === market.id);
    const marketPayments = payments.filter(
      (payment) => payment.marketId === market.id && payment.status === "completed",
    );
    const marketUtilities = utilityCharges.filter((charge) => charge.marketId === market.id);
    const marketPenalties = penalties.filter((penalty) => penalty.marketId === market.id);
    const marketComplaints = tickets.filter(
      (ticket) => ticket.marketId === market.id && ticket.status !== "resolved",
    );

    const utilitiesDue = marketUtilities
      .filter((charge) => riskStatuses.has(charge.status))
      .reduce((sum, charge) => sum + charge.amount, 0);

    const openPenalties = marketPenalties.filter((penalty) =>
      ["unpaid", "pending", "pending_payment"].includes(penalty.status),
    ).length;

    const overdue =
      marketUtilities.filter((charge) => charge.status === "overdue").length + openPenalties;

    const revenue = marketPayments.reduce((sum, payment) => sum + payment.amount, 0);

    return {
      id: market.id,
      name: market.name,
      vendors: marketVendors.length || market.vendorCount,
      revenue,
      utilitiesDue,
      penalties: openPenalties,
      complaints: marketComplaints.length,
      status: getMarketStatus({
        utilitiesDue,
        penalties: openPenalties,
        complaints: marketComplaints.length,
        overdue,
      }),
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
      .filter(
        (row) =>
          row.amount > 0 &&
          new Date(bookingEndDateById(regionBookings, row.id)).getTime() < Date.now(),
      ),
  ].slice(0, 5);

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
    .slice(0, 5);

  const complianceIssueRows = [
    ...overdueRows.map((item) => ({
      id: item.id,
      vendorName: item.vendor,
      marketName: item.market,
      amount: item.amount,
      detail: item.detail,
      status: null,
    })),
    ...utilityRows.map((item) => ({
      id: item.id,
      vendorName: item.vendorName,
      marketName: item.marketName || "Assigned market",
      amount: item.amount,
      detail: `${utilityLabels[item.utilityType]} - ${item.marketName || "Assigned market"}`,
      status: item.status,
    })),
  ].slice(0, 5);

  const summaryCards = [
    { label: "Markets", value: scopedMarkets.length.toLocaleString(), icon: Landmark },
    { label: "Vendors", value: regionVendors.length.toLocaleString(), icon: Users },
    { label: "Revenue", value: formatCurrency(regionalRevenue), icon: Wallet },
    { label: "Utilities Due", value: formatCurrency(regionalUtilityDue), icon: ReceiptText },
    { label: "Overdue", value: regionalOverdueCount.toLocaleString(), icon: AlertCircle },
    { label: "Alerts", value: regionalComplianceAlerts.toLocaleString(), icon: ShieldCheck },
  ];

  const occupancyRate = regionStalls.length
    ? Math.round(
        (regionStalls.filter((stall) => stall.status === "active").length / regionStalls.length) *
          100,
      )
    : 0;

  const paymentCompletionRate = regionPayments.length
    ? Math.round(
        (regionPayments.filter((payment) => payment.status === "completed").length /
          regionPayments.length) *
          100,
      )
    : 0;

  return (
    <div className="space-y-4 lg:space-y-5">
      <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm lg:p-5">
        <h1 className="text-2xl font-bold font-heading lg:text-[2rem] leading-tight">
          National Market Oversight
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Monitor market performance, compliance, and financial activity across regions.
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="card-warm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-base font-heading">Uganda Regional Map</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-4 pb-4">
            <svg
              viewBox="0 0 288 256"
              role="img"
              aria-label="Uganda region selection map"
              className="h-[300px] w-full"
            >
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
                      onClick={() => selectRegion(region.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          selectRegion(region.id);
                        }
                      }}
                      fill={selected ? "hsl(var(--primary) / 0.22)" : "hsl(var(--muted) / 0.58)"}
                      stroke={selected ? "hsl(var(--primary))" : "hsl(var(--border))"}
                      strokeWidth={selected ? 2.4 : 1.4}
                      opacity={selected ? 1 : 0.5}
                      className="cursor-pointer transition-opacity hover:opacity-100"
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
                  onClick={() => selectRegion(region.id)}
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
          <CardHeader className="pb-2 pt-4 px-4">
            <div>
              <CardTitle className="text-base font-heading">
                {selectedScopeLabel}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedRegionInfo.description}
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 px-4 pb-4">
            <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <span>Uganda</span>
              <span>&gt;</span>
              <button type="button" className="font-medium text-foreground" onClick={() => selectRegion(selectedRegion)}>
                {selectedRegionInfo.name}
              </button>
              {selectedArea ? (
                <>
                  <span>&gt;</span>
                  <button
                    type="button"
                    className="font-medium text-foreground"
                    onClick={() => setSelectedSubAreaId(null)}
                  >
                    {selectedArea.name}
                  </button>
                </>
              ) : null}
              {selectedSubArea ? (
                <>
                  <span>&gt;</span>
                  <span className="font-medium text-foreground">{selectedSubArea.name}</span>
                </>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-muted-foreground">{selectedRegionInfo.name} areas</p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAreaId(null);
                    setSelectedSubAreaId(null);
                  }}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                    selectedAreaId === null
                      ? "border-foreground/25 bg-foreground text-background"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {selectedAreas.map((area) => {
                  const count = regionMarkets.filter((market) => getMarketAreaId(market) === area.id).length;
                  return (
                    <button
                      key={area.id}
                      type="button"
                      onClick={() => {
                        setSelectedAreaId(area.id);
                        setSelectedSubAreaId(null);
                      }}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        selectedAreaId === area.id
                          ? "border-foreground/25 bg-muted text-foreground"
                          : "border-border/70 bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="block text-sm font-medium">{area.name}</span>
                      <span className="mt-1 block text-xs">{area.type} - {count} markets</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedArea && selectedSubAreas.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium text-muted-foreground">{selectedArea.name} sub-areas</p>
                  <button
                    type="button"
                    onClick={() => setSelectedSubAreaId(null)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                      selectedSubAreaId === null
                        ? "border-foreground/25 bg-foreground text-background"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {selectedSubAreas.map((subArea) => {
                    const count = regionMarkets.filter((market) => getMarketSubAreaId(market) === subArea.id).length;
                    return (
                      <button
                        key={subArea.id}
                        type="button"
                        onClick={() => setSelectedSubAreaId(subArea.id)}
                        className={`rounded-lg border p-3 text-left transition-colors ${
                          selectedSubAreaId === subArea.id
                            ? "border-foreground/25 bg-muted text-foreground"
                            : "border-border/70 bg-background text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <span className="block text-sm font-medium">{subArea.name}</span>
                        <span className="mt-1 block text-xs">{subArea.type} - {count} markets</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              {summaryCards.map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-border/70 bg-background p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="mt-1 text-lg font-bold font-heading">{item.value}</p>
                    </div>
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="card-warm h-[320px] flex flex-col">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-base font-heading">Markets in Selected Area</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto px-4 pb-4">
          {marketRows.length === 0 ? (
            <EmptyState
              title="No markets in this area"
              description="Registered markets for the selected region, district, or sub-area will appear here."
            />
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
                    <TableCell className="text-right">
                      {formatCurrency(market.utilitiesDue)}
                    </TableCell>
                    <TableCell className="text-right">{market.penalties}</TableCell>
                    <TableCell className="text-right">{market.complaints}</TableCell>
                    <TableCell>
                      <span className={statusClassName(market.status)}>{market.status}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="card-warm h-[300px] flex flex-col">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-base font-heading">Compliance Issues</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto space-y-3 px-4 pb-4">
            {complianceIssueRows.length === 0 ? (
              <EmptyState
                title="No compliance issues"
                description="Overdue bookings, unpaid utilities, and other regional issues will appear here."
              />
            ) : (
              complianceIssueRows.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-border/70 bg-background p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{item.vendorName}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.marketName}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(item.amount)}</p>
                      {item.status ? (
                        <div className="mt-2">
                          <StatusBadge status={item.status} context="obligation" />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="card-warm h-[300px]">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-base font-heading">Financial Overview</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 px-4 pb-4">
            <div className="rounded-xl border border-border/70 bg-background p-3 shadow-sm">
              <p className="text-xs text-muted-foreground">Revenue</p>
              <p className="mt-1 text-lg font-bold font-heading">
                {formatCurrency(regionalRevenue)}
              </p>
            </div>

            <div className="rounded-xl border border-border/70 bg-background p-3 shadow-sm">
              <p className="text-xs text-muted-foreground">Utilities Due</p>
              <p className="mt-1 text-lg font-bold font-heading">
                {formatCurrency(regionalUtilityDue)}
              </p>
            </div>

            <div className="rounded-xl border border-border/70 bg-background p-3 shadow-sm">
              <p className="text-xs text-muted-foreground">Overdue</p>
              <p className="mt-1 text-lg font-bold font-heading">{regionalOverdueCount}</p>
            </div>

            <div className="rounded-xl border border-border/70 bg-background p-3 shadow-sm">
              <p className="text-xs text-muted-foreground">Alerts</p>
              <p className="mt-1 text-lg font-bold font-heading">
                {regionalComplianceAlerts}
              </p>
            </div>

            <div className="rounded-xl border border-border/70 bg-background p-3 shadow-sm col-span-1">
              <p className="text-xs text-muted-foreground">Payment Completion</p>
              <p className="mt-1 text-lg font-bold font-heading">{paymentCompletionRate}%</p>
            </div>

            <div className="rounded-xl border border-border/70 bg-background p-3 shadow-sm col-span-1">
              <p className="text-xs text-muted-foreground">Occupancy</p>
              <p className="mt-1 text-lg font-bold font-heading">{occupancyRate}%</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OfficialDashboard;
