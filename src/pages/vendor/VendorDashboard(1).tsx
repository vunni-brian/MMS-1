import type { ElementType } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import {
 CalendarClock,
 CheckCircle2,
 CreditCard,
 FileText,
 MessageSquare,
 Store,
 UserRound,
 WalletCards,
 ChevronRight,
 AlertCircle
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { formatCurrency, formatHumanDate, getTimeAwareGreeting } from "@/lib/utils";
import { DASHBOARD_CONFIG } from "@/config/dashboard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const fallbackNotices = [
 { id: "cleaning", title: "Market cleaning schedule", body: "Cleaning starts at 7:00 AM on Saturday.", createdAt: "2026-05-20T09:00:00Z" },
 { id: "deadline", title: "Payment reminder", body: "Monthly dues should be cleared before month end.", createdAt: "2026-05-18T09:00:00Z" },
 { id: "safety", title: "Fire safety briefing", body: "A short safety briefing is scheduled for all food vendors.", createdAt: "2026-05-15T09:00:00Z" },
];



const QuickAction = ({ icon: Icon, label, to }: { icon: ElementType; label: string; to: string }) => (
 <Link
 to={to}
 className="group flex min-h-14 items-center gap-3 rounded-sm border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/40"
 >
 <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-border text-muted-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
 <Icon className="h-4 w-4" />
 </span>
 <span className="min-w-0 flex-1 text-sm font-semibold text-card-foreground">{label}</span>
 <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
 </Link>
);

const DashboardSkeleton = () => (
 <div className="space-y-6">
 <div className="space-y-2">
 <Skeleton className="h-8 w-[250px]" />
 <Skeleton className="h-4 w-[400px]" />
 </div>
 <div className="grid gap-6 md:grid-cols-3">
 {[1, 2, 3].map(i => <Skeleton key={i} className="h-[120px] rounded-sm" />)}
 </div>
 <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
 <div className="grid gap-6">
 <Skeleton className="h-[180px] rounded-sm" />
 <Skeleton className="h-[300px] rounded-sm" />
 </div>
 <div className="grid content-start gap-6">
 <Skeleton className="h-[250px] rounded-sm" />
 <Skeleton className="h-[200px] rounded-sm" />
 </div>
 </div>
 </div>
);

const VendorDashboard = () => {
 const { user } = useAuth();
 const isPendingVendor = user?.vendorStatus !== "approved";

 const stallsQuery = useQuery({
 queryKey: ["stalls", "mine"],
 queryFn: () => api.getStalls({ scope: "mine" }),
 enabled: !isPendingVendor,
 gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME,
 });
 const bookingsQuery = useQuery({
 queryKey: ["bookings"],
 queryFn: () => api.getBookings(),
 enabled: !isPendingVendor,
 gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME,
 });
 const paymentsQuery = useQuery({
 queryKey: ["payments"],
 queryFn: () => api.getPayments(),
 enabled: !isPendingVendor,
 refetchInterval: DASHBOARD_CONFIG.PAYMENTS_REFRESH_INTERVAL,
 gcTime: DASHBOARD_CONFIG.REALTIME_DATA_CACHE_TIME,
 });
 const ticketsQuery = useQuery({
 queryKey: ["tickets", "vendor-dashboard"],
 queryFn: () => api.getTickets(),
 enabled: !isPendingVendor,
 gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME,
 });
 const announcementsQuery = useQuery({
 queryKey: ["announcements", "vendor-dashboard"],
 queryFn: () => api.getAnnouncements({ active: true }),
 gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME,
 });

 const isLoading =
 (!isPendingVendor && (stallsQuery.isPending || bookingsQuery.isPending || paymentsQuery.isPending || ticketsQuery.isPending)) ||
 announcementsQuery.isPending;

 const isError =
 stallsQuery.isError ||
 bookingsQuery.isError ||
 paymentsQuery.isError ||
 ticketsQuery.isError ||
 announcementsQuery.isError;

 if (isError) {
 return (
 <div className="p-4 sm:p-6">
 <Alert variant="destructive" className="max-w-xl">
 <AlertCircle className="h-4 w-4" />
 <AlertTitle>Could not load dashboard</AlertTitle>
 <AlertDescription>There was a problem fetching your market data. Please refresh the page.</AlertDescription>
 </Alert>
 </div>
 );
 }

 if (isLoading) {
 return <DashboardSkeleton />;
 }

 const stalls = stallsQuery.data?.stalls || [];
 const bookings = bookingsQuery.data?.bookings || [];
 const payments = paymentsQuery.data?.payments || [];
 const tickets = ticketsQuery.data?.tickets || [];
 const notices = announcementsQuery.data?.announcements || [];
 const activeStall = stalls.find((stall) => stall.vendorId === user?.id && stall.status === "active") || stalls[0];
 const approvedBookings = bookings.filter((booking) => booking.status === "approved");
 const outstandingBalance = approvedBookings.reduce((sum, booking) => sum + booking.amount, 0);
 const openComplaints = tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status));
 const noticeRows = notices.length ? notices.slice(0, 3) : fallbackNotices;
 const paymentRows = [...payments]
 .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
 .slice(0, 4)
 .map((payment) => ({
 id: payment.id,
 title: payment.description || payment.chargeType.replace(/_/g, " "),
 amount: payment.amount,
 createdAt: payment.createdAt,
 }));
 const activityRows = [
 ...paymentRows.slice(0, 2).map((payment) => ({
 id: `payment-${payment.id}`,
 title: payment.title,
 detail: `${formatCurrency(payment.amount)} recorded`,
 icon: CreditCard,
 })),
 ...noticeRows.slice(0, 2).map((notice) => ({
 id: `notice-${notice.id}`,
 title: notice.title,
 detail: "Notice published",
 icon: FileText,
 })),
 ].slice(0, 4);

 const greeting = getTimeAwareGreeting(user?.name?.split(" ")[0] || "there");

 return (
 <div className="space-y-6">
 <div>
 <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Vendor Workspace</p>
 <h1 className="text-3xl font-bold font-heading text-foreground">{greeting}</h1>
 <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
 A simple view of your stall, dues, notices, and support requests at {user?.marketName || "your market"}.
 </p>
 </div>

 <div className="grid gap-6 md:grid-cols-3">
 <div>
 <Card className="h-full shadow-none">
 <CardHeader className="flex flex-row items-center justify-between pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">My Stall</CardTitle>
 <Store className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold font-heading">{activeStall?.name || "Not assigned"}</div>
 <p className="text-xs text-muted-foreground mt-1">
 {activeStall ? `${activeStall.zone} - ${activeStall.size}` : "Reserve a stall when available"}
 </p>
 </CardContent>
 </Card>
 </div>

 <div>
 <Card className="h-full shadow-none">
 <CardHeader className="flex flex-row items-center justify-between pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding Balance</CardTitle>
 <WalletCards className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold font-heading">{formatCurrency(outstandingBalance)}</div>
 <p className="text-xs text-muted-foreground mt-1">Current approved dues</p>
 </CardContent>
 </Card>
 </div>

 <div>
 <Card className="h-full shadow-none">
 <CardHeader className="flex flex-row items-center justify-between pb-2">
 <CardTitle className="text-sm font-medium text-muted-foreground">Complaint Status</CardTitle>
 <MessageSquare className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold font-heading">{openComplaints.length ? `${openComplaints.length} open` : "Clear"}</div>
 <p className="text-xs text-muted-foreground mt-1">
 {openComplaints.length ? "Support team is reviewing" : "No unresolved complaints"}
 </p>
 </CardContent>
 </Card>
 </div>
 </div>

 <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
 <div className="grid content-start gap-6">
 <div>
 <Card className="card-warm">
 <CardHeader>
 <CardTitle>Current Stall Details</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
 <div>
 <p className="text-3xl font-semibold tracking-tight font-heading">{activeStall?.name || "No active stall"}</p>
 <p className="mt-2 text-sm text-muted-foreground">
 {activeStall
 ? `${activeStall.zone} zone, ${activeStall.size}. Monthly dues are ${formatCurrency(activeStall.pricePerMonth)}.`
 : "Your dashboard will show stall details after a stall has been assigned."}
 </p>
 </div>
 <Badge variant={activeStall ? "default" : "secondary"} className="text-xs">
 {activeStall ? "Active" : "Pending"}
 </Badge>
 </div>
 </CardContent>
 </Card>
 </div>

 <div>
 <Card className="card-warm">
 <CardHeader className="flex flex-row items-center justify-between">
 <CardTitle>Payment History</CardTitle>
 <Link to="/vendor/payments" className="text-sm font-medium text-primary hover:underline">
 View all
 </Link>
 </CardHeader>
 <CardContent>
 {paymentRows.length === 0 ? (
 <div className="rounded-sm border border-border p-6 text-center text-sm text-muted-foreground">
 No payment records yet. Payments will appear here once dues are processed.
 </div>
 ) : (
 <div className="divide-y divide-border">
 {paymentRows.map((payment, index) => (
 <div key={payment.id} className="flex items-center justify-between gap-4 py-3">
 <div className="flex items-center gap-3">
 <span className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground">
 {index === 0 ? <CheckCircle2 className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
 </span>
 <div>
 <p className="text-sm font-semibold">{payment.title}</p>
 <p className="text-xs text-muted-foreground">{formatHumanDate(payment.createdAt)}</p>
 </div>
 </div>
 <p className="text-sm font-bold tabular-nums">{formatCurrency(payment.amount)}</p>
 </div>
 ))}
 </div>
 )}
 </CardContent>
 </Card>
 </div>

 <div>
 <Card className="card-warm">
 <CardHeader>
 <CardTitle>Recent Activity</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="divide-y divide-border">
 {activityRows.map((item) => {
 const Icon = item.icon;
 return (
 <div key={item.id} className="flex items-center gap-3 py-3">
 <span className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground">
 <Icon className="h-4 w-4" />
 </span>
 <div>
 <p className="text-sm font-semibold">{item.title}</p>
 <p className="text-xs text-muted-foreground">{item.detail}</p>
 </div>
 </div>
 );
 })}
 </div>
 </CardContent>
 </Card>
 </div>
 </div>

 <div className="grid content-start gap-6">
 <div>
 <Card className="card-warm">
 <CardHeader className="flex flex-row items-center justify-between">
 <CardTitle>Notifications</CardTitle>
 <Link to="/vendor/announcements" className="text-sm font-medium text-primary hover:underline">
 View all
 </Link>
 </CardHeader>
 <CardContent>
 <div className="space-y-4">
 {noticeRows.map((notice) => (
 <div key={notice.id} className="border-b border-border/50 pb-4 last:border-0 last:pb-0">
 <p className="text-sm font-semibold">{notice.title}</p>
 <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{notice.body}</p>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 </div>

 <div>
 <Card className="card-warm">
 <CardHeader>
 <CardTitle>Quick Actions</CardTitle>
 </CardHeader>
 <CardContent className="grid gap-3">
 <QuickAction icon={CreditCard} label="Pay dues" to="/vendor/payments" />
 <QuickAction icon={MessageSquare} label="Report issue" to="/vendor/complaints" />
 <QuickAction icon={Store} label="Reserve stall" to="/vendor/stalls" />
 <QuickAction icon={UserRound} label="Update profile" to="/vendor/profile" />
 </CardContent>
 </Card>
 </div>

 <div>
 <Card className="rounded-sm border-amber-200 bg-amber-50/60 shadow-none dark:border-amber-900/50 dark:bg-amber-900/10">
 <CardContent className="pt-6">
 <div className="flex gap-4">
 <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-amber-200 text-amber-700 dark:border-amber-900/50 dark:text-amber-400">
 <CalendarClock className="h-4 w-4" />
 </div>
 <div>
 <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Month-end collection</p>
 <p className="mt-1 text-xs text-amber-700 dark:text-amber-400/80">
 Clear pending dues before the last working day to avoid late fees.
 </p>
 </div>
 </div>
 </CardContent>
 </Card>
 </div>
 </div>
 </div>
 </div>
 );
};

export default VendorDashboard;
