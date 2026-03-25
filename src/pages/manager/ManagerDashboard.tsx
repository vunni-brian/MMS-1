import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle,
  CreditCard,
  Grid3X3,
  MapPinned,
  ShieldAlert,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";

const chartPalette = ["#2563eb", "#f59e0b", "#10b981", "#ef4444", "#6b7280"];

const endOfDay = (dateValue: string) => new Date(`${dateValue}T23:59:59`);

const ManagerDashboard = () => {
  const queryClient = useQueryClient();
  const [selectedStallId, setSelectedStallId] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestForm, setRequestForm] = useState({
    category: "budget" as "budget" | "structural",
    title: "",
    description: "",
    amountRequested: 0,
  });

  const { data: stallsData } = useQuery({ queryKey: ["stalls"], queryFn: () => api.getStalls() });
  const { data: bookingsData } = useQuery({ queryKey: ["bookings"], queryFn: () => api.getBookings() });
  const { data: paymentsData } = useQuery({ queryKey: ["payments"], queryFn: () => api.getPayments(), refetchInterval: 10_000 });
  const { data: vendorsData } = useQuery({ queryKey: ["vendors"], queryFn: () => api.getVendors() });
  const { data: ticketsData } = useQuery({ queryKey: ["tickets"], queryFn: () => api.getTickets() });
  const { data: resourceRequestsData } = useQuery({
    queryKey: ["resource-requests"],
    queryFn: () => api.getResourceRequests(),
  });

  const createResourceRequest = useMutation({
    mutationFn: () => api.createResourceRequest(requestForm),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["resource-requests"] });
      setRequestForm({
        category: "budget",
        title: "",
        description: "",
        amountRequested: 0,
      });
      setRequestError(null);
    },
    onError: (error) => setRequestError(error instanceof ApiError ? error.message : "Unable to submit request."),
  });

  const stalls = stallsData?.stalls || [];
  const bookings = bookingsData?.bookings || [];
  const payments = paymentsData?.payments || [];
  const vendors = vendorsData?.vendors || [];
  const tickets = ticketsData?.tickets || [];
  const resourceRequests = resourceRequestsData?.requests || [];

  const paidByBooking = payments.reduce<Record<string, number>>((accumulator, payment) => {
    if (payment.status === "completed") {
      accumulator[payment.bookingId] = (accumulator[payment.bookingId] || 0) + payment.amount;
    }
    return accumulator;
  }, {});

  const bookingById = bookings.reduce<Record<string, (typeof bookings)[number]>>((accumulator, booking) => {
    accumulator[booking.id] = booking;
    return accumulator;
  }, {});

  const totalRevenue = payments.filter((payment) => payment.status === "completed").reduce((sum, payment) => sum + payment.amount, 0);
  const occupancyRate = stalls.length
    ? Math.round((stalls.filter((stall) => ["reserved", "paid", "confirmed"].includes(stall.status)).length / stalls.length) * 100)
    : 0;
  const collectionRate = bookings.length
    ? Math.round(
        (bookings.reduce((sum, booking) => sum + Math.min(paidByBooking[booking.id] || 0, booking.amount), 0) /
          bookings.reduce((sum, booking) => sum + booking.amount, 0)) *
          100,
      )
    : 0;
  const unresolvedTicketRate = tickets.length
    ? tickets.filter((ticket) => ticket.status !== "resolved").length / tickets.length
    : 0;
  const sentimentScore = Math.round(
    collectionRate * 0.45 + occupancyRate * 0.35 + (1 - unresolvedTicketRate) * 20,
  );

  const sentiment = sentimentScore >= 75
    ? {
        label: "Green",
        color: "bg-success",
        ring: "ring-success/20",
        text: "Collections are healthy, complaints are contained, and the market is moving well.",
      }
    : sentimentScore >= 50
      ? {
          label: "Amber",
          color: "bg-warning",
          ring: "ring-warning/20",
          text: "Conditions are stable but need follow-up on dues, complaints, or occupancy pressure.",
        }
      : {
          label: "Red",
          color: "bg-destructive",
          ring: "ring-destructive/20",
          text: "Vendor friction or weak collections need immediate management attention.",
        };

  const permitAlerts = bookings
    .map((booking) => {
      const expiresAt = endOfDay(booking.endDate);
      const hoursLeft = Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60));
      const outstanding = Math.max(booking.amount - (paidByBooking[booking.id] || 0), 0);
      return {
        ...booking,
        hoursLeft,
        outstanding,
      };
    })
    .filter((booking) => ["paid", "confirmed"].includes(booking.status) && booking.hoursLeft >= 0 && booking.hoursLeft <= 48)
    .sort((left, right) => left.hoursLeft - right.hoursLeft);

  const stallFlowData = [
    { name: "Available", value: stalls.filter((stall) => stall.status === "available").length },
    { name: "Reserved", value: stalls.filter((stall) => stall.status === "reserved").length },
    { name: "Paid", value: stalls.filter((stall) => stall.status === "paid").length },
    { name: "Confirmed", value: stalls.filter((stall) => stall.status === "confirmed").length },
    { name: "Maintenance", value: stalls.filter((stall) => stall.status === "maintenance").length },
  ];

  const paymentStatusData = [
    { name: "Completed", value: payments.filter((payment) => payment.status === "completed").length },
    { name: "Pending", value: payments.filter((payment) => payment.status === "pending").length },
    { name: "Failed", value: payments.filter((payment) => payment.status === "failed").length },
  ];

  const zoneLoadData = Object.values(
    stalls.reduce<Record<string, { zone: string; occupied: number; free: number }>>((accumulator, stall) => {
      const current = accumulator[stall.zone] || { zone: stall.zone, occupied: 0, free: 0 };
      if (["reserved", "paid", "confirmed"].includes(stall.status)) {
        current.occupied += 1;
      } else if (stall.status === "available") {
        current.free += 1;
      }
      accumulator[stall.zone] = current;
      return accumulator;
    }, {}),
  );

  const mapTiles = [...stalls]
    .sort((left, right) => left.zone.localeCompare(right.zone) || left.name.localeCompare(right.name))
    .map((stall) => {
      const activeBooking = stall.activeBooking ? bookingById[stall.activeBooking.id] : null;
      const outstanding = activeBooking ? Math.max(activeBooking.amount - (paidByBooking[activeBooking.id] || 0), 0) : 0;
      const isOverdue = Boolean(activeBooking && outstanding > 0 && (activeBooking.status === "reserved" || endOfDay(activeBooking.endDate).getTime() <= Date.now()));

      if (stall.status === "maintenance") {
        return { ...stall, stateLabel: "Maintenance", className: "border-slate-300 bg-slate-100 text-slate-700" };
      }
      if (isOverdue) {
        return { ...stall, stateLabel: "Overdue", className: "border-destructive/40 bg-destructive/10 text-destructive" };
      }
      if (["paid", "confirmed"].includes(stall.status) || Boolean(activeBooking && outstanding === 0)) {
        return { ...stall, stateLabel: "Paid", className: "border-success/40 bg-success/10 text-success" };
      }
      if (stall.status === "available") {
        return { ...stall, stateLabel: "Free", className: "border-primary/20 bg-primary/5 text-primary" };
      }
      return { ...stall, stateLabel: "Reserved", className: "border-warning/40 bg-warning/10 text-warning" };
    });

  const selectedStall = mapTiles.find((stall) => stall.id === selectedStallId) || mapTiles[0] || null;

  const stats = [
    { label: "Total Revenue", value: `UGX ${totalRevenue.toLocaleString()}`, icon: TrendingUp, color: "text-success" },
    { label: "Occupancy Rate", value: `${occupancyRate}%`, icon: Grid3X3, color: "text-primary" },
    { label: "Available Stalls", value: stalls.filter((stall) => stall.status === "available").length, icon: CheckCircle, color: "text-info" },
    { label: "Pending Approvals", value: vendors.filter((vendor) => vendor.status === "pending").length, icon: Users, color: "text-warning" },
    { label: "Late Payment Risk", value: bookings.filter((booking) => booking.status === "reserved").length, icon: CreditCard, color: "text-warning" },
    { label: "Open Tickets", value: tickets.filter((ticket) => ticket.status !== "resolved").length, icon: AlertCircle, color: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading">Manager Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Operations, alerts, stall activity, and escalation requests.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="card-warm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-bold font-heading mt-1">{stat.value}</p>
                </div>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid xl:grid-cols-[0.9fr_1.1fr] gap-4">
        <Card className="card-warm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Market Sentiment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`rounded-2xl border bg-card p-4 ring-4 ${sentiment.ring}`}>
              <div className="flex items-center gap-3">
                <div className={`h-4 w-4 rounded-full ${sentiment.color}`} />
                <div>
                  <p className="text-sm font-semibold font-heading">{sentiment.label} Signal</p>
                  <p className="text-xs text-muted-foreground">Score {sentimentScore}/100</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{sentiment.text}</p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Collection</p>
                <p className="text-lg font-bold font-heading mt-1">{collectionRate}%</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Occupancy</p>
                <p className="text-lg font-bold font-heading mt-1">{occupancyRate}%</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Feedback Pressure</p>
                <p className="text-lg font-bold font-heading mt-1">{Math.round(unresolvedTicketRate * 100)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-warm border-destructive/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-destructive" />
              Critical Permit Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {permitAlerts.length === 0 ? (
              <div className="rounded-xl border border-success/20 bg-success/5 p-4 text-sm text-muted-foreground">
                No active permits expire within the next 48 hours.
              </div>
            ) : (
              permitAlerts.map((alert) => (
                <div key={alert.id} className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm">{alert.vendorName}</p>
                      <p className="text-xs text-muted-foreground">{alert.stallName} permit ends on {alert.endDate}</p>
                    </div>
                    <span className="rounded-full bg-destructive/15 px-2.5 py-1 text-xs font-medium text-destructive">
                      {alert.hoursLeft}h left
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Outstanding balance: UGX {alert.outstanding.toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid xl:grid-cols-2 gap-4">
        <Card className="card-warm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Stall Lifecycle</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stallFlowData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {stallFlowData.map((entry, index) => (
                    <Cell key={entry.name} fill={chartPalette[index % chartPalette.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="card-warm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Payment Outcomes</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={paymentStatusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {paymentStatusData.map((entry, index) => (
                    <Cell key={entry.name} fill={chartPalette[index % chartPalette.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="card-warm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Zone Capacity</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={zoneLoadData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="zone" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="occupied" stackId="a" fill="#2563eb" radius={[6, 6, 0, 0]} />
              <Bar dataKey="free" stackId="a" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid xl:grid-cols-[1.2fr_0.8fr] gap-4">
        <Card className="card-warm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <MapPinned className="w-4 h-4" />
              Interactive Market Map
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {mapTiles.map((stall) => (
                <button
                  key={stall.id}
                  type="button"
                  onClick={() => setSelectedStallId(stall.id)}
                  className={`rounded-2xl border p-4 text-left transition-all hover:shadow-md ${stall.className} ${selectedStallId === stall.id ? "ring-2 ring-primary/40" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold font-heading">{stall.name}</span>
                    <span className="text-[11px] uppercase tracking-wide">{stall.stateLabel}</span>
                  </div>
                  <p className="mt-2 text-xs opacity-80">{stall.zone}</p>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-success" /> Paid</span>
              <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-destructive" /> Overdue</span>
              <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-primary" /> Free</span>
              <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-slate-400" /> Maintenance</span>
            </div>
          </CardContent>
        </Card>

        <Card className="card-warm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Selected Stall</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedStall ? (
              <>
                <div>
                  <p className="text-lg font-bold font-heading">{selectedStall.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedStall.zone}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">State</p>
                    <p className="mt-1 font-medium">{selectedStall.stateLabel}</p>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Monthly Rent</p>
                    <p className="mt-1 font-medium">UGX {selectedStall.pricePerMonth.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-3 col-span-2">
                    <p className="text-xs text-muted-foreground">Vendor</p>
                    <p className="mt-1 font-medium">{selectedStall.vendorName || "Unassigned"}</p>
                  </div>
                </div>
                {selectedStall.activeBooking && bookingById[selectedStall.activeBooking.id] && (
                  <div className="rounded-xl border bg-muted/20 p-4">
                    <p className="text-xs text-muted-foreground">Current booking</p>
                    <p className="mt-1 text-sm font-medium">
                      {bookingById[selectedStall.activeBooking.id].startDate} to {bookingById[selectedStall.activeBooking.id].endDate}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Outstanding: UGX{" "}
                      {Math.max(
                        bookingById[selectedStall.activeBooking.id].amount -
                          (paidByBooking[selectedStall.activeBooking.id] || 0),
                        0,
                      ).toLocaleString()}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No stalls available to inspect.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid xl:grid-cols-[0.95fr_1.05fr] gap-4">
        <Card className="card-warm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Submit Resource Request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="request-category">Category</Label>
              <Select value={requestForm.category} onValueChange={(value: "budget" | "structural") => setRequestForm((current) => ({ ...current, category: value }))}>
                <SelectTrigger id="request-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="budget">Budget</SelectItem>
                  <SelectItem value="structural">Structural</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="request-title">Title</Label>
              <Input id="request-title" value={requestForm.title} onChange={(event) => setRequestForm((current) => ({ ...current, title: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="request-amount">Amount Requested</Label>
              <Input
                id="request-amount"
                type="number"
                value={requestForm.amountRequested}
                onChange={(event) => setRequestForm((current) => ({ ...current, amountRequested: Number(event.target.value) }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="request-description">Description</Label>
              <Textarea
                id="request-description"
                rows={5}
                value={requestForm.description}
                onChange={(event) => setRequestForm((current) => ({ ...current, description: event.target.value }))}
              />
            </div>
            {requestError && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{requestError}</div>}
            <Button className="w-full" onClick={() => createResourceRequest.mutate()} disabled={createResourceRequest.isPending}>
              Submit For Official Review
            </Button>
          </CardContent>
        </Card>

        <Card className="card-warm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">My Resource Requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {resourceRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No resource requests submitted yet.</p>
            ) : (
              resourceRequests.slice(0, 5).map((request) => (
                <div key={request.id} className="rounded-xl border bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm">{request.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">{request.category} request</p>
                    </div>
                    <StatusBadge status={request.status} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{request.description}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Asked: UGX {request.amountRequested.toLocaleString()}</span>
                    <span>
                      {request.approvedAmount ? `Approved: UGX ${request.approvedAmount.toLocaleString()}` : "Awaiting review"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ManagerDashboard;
