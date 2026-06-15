import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
 Activity,
 BadgeCheck,
 Building2,
 ClipboardList,
 KeyRound,
 Plus,
 Search,
 ShieldCheck,
 Users,
} from "lucide-react";

import { DASHBOARD_CONFIG } from "@/config/dashboard";
import { permissionGroups, permissionLabels, rolePermissionMatrix } from "@/config/permissions";
import { api } from "@/lib/api";
import { cn, formatHumanDateTime } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogFooter,
 DialogHeader,
 DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/EmptyState";
import {
  ConsolePage,
  DataTableFrame,
  DetailSheet,
  LoadingState,
  PageHeader,
  Panel,
  SegmentedControl,
} from "@/components/console/ConsolePage";
import type { Permission, Role, StaffAccount, StaffStatus } from "@/types";

type StaffRole = Extract<Role, "manager" | "official">;
type UserTab = "all" | "manager" | "official" | "vendor" | "permissions" | "activity";

interface InviteFormState {
 firstName: string;
 lastName: string;
 email: string;
 phone: string;
 role: StaffRole;
 marketId: string;
 department: string;
 assignedRegion: string;
 staffIdentifier: string;
 accessLevel: string;
 status: StaffStatus;
 responsibilities: string;
 permissions: Permission[];
}

const defaultResponsibilities: Record<StaffRole, string[]> = {
 manager: ["Market workflows", "Vendor approvals", "Payment follow-up"],
 official: ["Vendor compliance", "Utility monitoring", "Complaints review"],
};

const createInviteForm = (role: StaffRole = "manager"): InviteFormState => ({
 firstName: "",
 lastName: "",
 email: "",
 phone: "",
 role,
 marketId: "",
 department: role === "manager" ? "Market Operations" : "Compliance",
 assignedRegion: "",
 staffIdentifier: "",
 accessLevel: role === "manager" ? "market_supervision" : "regional_compliance",
 status: "active",
 responsibilities: defaultResponsibilities[role].join("\n"),
 permissions: rolePermissionMatrix[role],
});

const tabOptions: Array<{ value: UserTab; label: string }> = [
 { value: "all", label: "All Users" },
 { value: "manager", label: "Managers" },
 { value: "official", label: "Officials" },
 { value: "vendor", label: "Vendors" },
 { value: "permissions", label: "Roles & Permissions" },
 { value: "activity", label: "Activity Log" },
];

const statusClassName = (status: StaffStatus) => {
 if (status === "active") return "status-badge border-success/20 bg-success/15 text-success";
 if (status === "pending") return "status-badge border-warning/25 bg-warning/15 text-warning";
 return "status-badge border-destructive/20 bg-destructive/15 text-destructive";
};

const roleClassName = (role: Role) => {
 if (role === "admin") return "status-badge border-primary/20 bg-primary/10 text-primary";
 if (role === "official") return "status-badge border-info/20 bg-info/15 text-info";
 if (role === "manager") return "status-badge border-success/20 bg-success/15 text-success";
 return "status-badge border-border bg-muted text-muted-foreground";
};

const formatRole = (role: Role) => role.charAt(0).toUpperCase() + role.slice(1);

const parseResponsibilities = (value: string) =>
 value
 .split(/\n|,/)
 .map((item) => item.trim())
 .filter(Boolean);

const getLastActiveLabel = (account: StaffAccount) =>
 account.lastActiveAt ? formatHumanDateTime(account.lastActiveAt) : "No activity";

const UserManagementPage = () => {
 const queryClient = useQueryClient();
 const [activeTab, setActiveTab] = useState<UserTab>("all");
 const [search, setSearch] = useState("");
 const [inviteOpen, setInviteOpen] = useState(false);
 const [inviteForm, setInviteForm] = useState<InviteFormState>(() => createInviteForm());

 const usersQuery = useQuery({
 queryKey: ["users", "admin-user-management"],
 queryFn: () => api.getUsers(),
 gcTime: DASHBOARD_CONFIG.DEFAULT_CACHE_TIME,
 });

 const marketsQuery = useQuery({
 queryKey: ["markets", "admin-user-management"],
 queryFn: () => api.getMarkets(),
 gcTime: DASHBOARD_CONFIG.STATIC_DATA_CACHE_TIME,
 });

 const inviteMutation = useMutation({
 mutationFn: api.inviteStaffUser,
 onSuccess: (response) => {
 toast.success("Staff invite sent", { description: response.message });
 setInviteOpen(false);
 setInviteForm(createInviteForm());
 queryClient.invalidateQueries({ queryKey: ["users"] });
 },
 onError: (error) => {
 toast.error("Invite was not sent", {
 description: error instanceof Error ? error.message : "Check the staff details and try again.",
 });
 },
 });

 const users = useMemo(() => usersQuery.data?.users ?? [], [usersQuery.data?.users]);
 const markets = useMemo(() => marketsQuery.data?.markets ?? [], [marketsQuery.data?.markets]);
 const isLoading = usersQuery.isPending || marketsQuery.isPending;

 const filteredUsers = useMemo(() => {
 const query = search.trim().toLowerCase();
 return users.filter((account) => {
 if (activeTab === "manager" && account.role !== "manager") return false;
 if (activeTab === "official" && account.role !== "official") return false;
 if (activeTab === "vendor" && account.role !== "vendor") return false;
 if (activeTab === "permissions" || activeTab === "activity") return true;
 if (!query) return true;

 return [
 account.name,
 account.email,
 account.phone,
 account.role,
 account.department || "",
 account.assignedRegion || "",
 account.marketName || "",
 ]
 .join(" ")
 .toLowerCase()
 .includes(query);
 });
 }, [activeTab, search, users]);

 const activityRows = useMemo(
 () =>
 [...users].sort((left, right) => {
 const leftDate = left.lastActiveAt || left.createdAt;
 const rightDate = right.lastActiveAt || right.createdAt;
 return new Date(rightDate).getTime() - new Date(leftDate).getTime();
 }),
 [users],
 );

 const managerCount = users.filter((account) => account.role === "manager").length;
 const officialCount = users.filter((account) => account.role === "official").length;
 const vendorCount = users.filter((account) => account.role === "vendor").length;

 const tabCounts: Record<UserTab, number | undefined> = {
 all: users.length,
 manager: managerCount,
 official: officialCount,
 vendor: vendorCount,
 permissions: undefined,
 activity: activityRows.length,
 };

 const setInviteRole = (role: StaffRole) => {
 setInviteForm((current) => ({
 ...current,
 role,
 department: role === "manager" ? "Market Operations" : "Compliance",
 staffIdentifier: role === "manager" ? "" : current.staffIdentifier,
 accessLevel: role === "manager" ? "market_supervision" : "regional_compliance",
 responsibilities: defaultResponsibilities[role].join("\n"),
 permissions: rolePermissionMatrix[role],
 }));
 };

 const togglePermission = (permission: Permission, checked: boolean) => {
 setInviteForm((current) => ({
 ...current,
 permissions: checked
 ? [...new Set([...current.permissions, permission])]
 : current.permissions.filter((item) => item !== permission),
 }));
 };

 const handleMarketChange = (marketId: string) => {
 const selectedMarket = markets.find((market) => market.id === marketId);
 setInviteForm((current) => ({
 ...current,
 marketId,
 assignedRegion: current.assignedRegion || selectedMarket?.regionName || selectedMarket?.location || "",
 }));
 };

 const handleInviteSubmit = (event: FormEvent<HTMLFormElement>) => {
 event.preventDefault();
 inviteMutation.mutate({
 firstName: inviteForm.firstName.trim(),
 lastName: inviteForm.lastName.trim(),
 email: inviteForm.email.trim(),
 phone: inviteForm.phone.trim(),
 role: inviteForm.role,
 marketId: inviteForm.marketId || null,
 department: inviteForm.department.trim(),
 assignedRegion: inviteForm.assignedRegion.trim(),
 staffIdentifier: inviteForm.staffIdentifier.trim() || null,
 accessLevel: inviteForm.accessLevel,
 status: inviteForm.status,
 responsibilities: parseResponsibilities(inviteForm.responsibilities),
 permissions: inviteForm.permissions,
 });
 };

 if (isLoading) {
 return (
 <ConsolePage>
 <LoadingState rows={1} itemClassName="h-28 rounded-lg" />
 <LoadingState rows={4} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" itemClassName="h-24 rounded-lg" />
 <LoadingState rows={2} itemClassName="h-[320px] rounded-lg" />
 </ConsolePage>
 );
 }

 return (
 <ConsolePage>
 <PageHeader
 eyebrow="Personnel administration"
 title="Personnel & Access Control"
 description="Invite staff, assign roles, scope permissions, and keep manager and official access under admin control."
 actions={
 <Button onClick={() => setInviteOpen(true)} className="gap-2">
 <Plus className="h-4 w-4" />
 Invite Staff
 </Button>
 }
 />

 <Panel className="workspace-toolbar-panel" contentClassName="space-y-3">
 <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
 <SegmentedControl
 value={activeTab}
 onChange={setActiveTab}
 options={tabOptions.map((option) => ({ ...option, count: tabCounts[option.value] }))}
 className="max-w-full"
 />
 <div className="relative min-w-0 lg:w-[320px]">
 <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
 <Input
 value={search}
 onChange={(event) => setSearch(event.target.value)}
 placeholder="Search users, roles, departments..."
 className="h-9 pl-9"
 />
 </div>
 </div>
 </Panel>

 {activeTab === "permissions" ? (
 <RolesPermissionsPanel />
 ) : activeTab === "activity" ? (
 <ActivityPanel rows={activityRows} />
 ) : (
 <UsersTable rows={filteredUsers} />
 )}

 <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
 <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
 <DialogHeader>
 <DialogTitle>Invite Staff</DialogTitle>
 <DialogDescription>
 Staff accounts receive scoped permissions and temporary sign-in details.
 </DialogDescription>
 </DialogHeader>

 <form className="space-y-4" onSubmit={handleInviteSubmit}>
 <div className="grid gap-3 sm:grid-cols-2">
 <div className="space-y-1.5">
 <Label htmlFor="staff-role">Role</Label>
 <Select value={inviteForm.role} onValueChange={(value) => setInviteRole(value as StaffRole)}>
 <SelectTrigger id="staff-role">
 <SelectValue placeholder="Select role" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="manager">Manager</SelectItem>
 <SelectItem value="official">Official</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-1.5">
 <Label htmlFor="staff-status">Status</Label>
 <Select
 value={inviteForm.status}
 onValueChange={(value) => setInviteForm((current) => ({ ...current, status: value as StaffStatus }))}
 >
 <SelectTrigger id="staff-status">
 <SelectValue placeholder="Select status" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="active">Active</SelectItem>
 <SelectItem value="pending">Pending</SelectItem>
 <SelectItem value="suspended">Suspended</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-1.5">
 <Label htmlFor="first-name">First Name</Label>
 <Input
 id="first-name"
 value={inviteForm.firstName}
 onChange={(event) => setInviteForm((current) => ({ ...current, firstName: event.target.value }))}
 required
 />
 </div>

 <div className="space-y-1.5">
 <Label htmlFor="last-name">Last Name</Label>
 <Input
 id="last-name"
 value={inviteForm.lastName}
 onChange={(event) => setInviteForm((current) => ({ ...current, lastName: event.target.value }))}
 required
 />
 </div>

 <div className="space-y-1.5">
 <Label htmlFor="staff-email">Email</Label>
 <Input
 id="staff-email"
 type="email"
 value={inviteForm.email}
 onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))}
 required
 />
 </div>

 <div className="space-y-1.5">
 <Label htmlFor="staff-phone">Phone Number</Label>
 <Input
 id="staff-phone"
 value={inviteForm.phone}
 onChange={(event) => setInviteForm((current) => ({ ...current, phone: event.target.value }))}
 placeholder="+256 7XX XXX XXX"
 required
 />
 {inviteForm.phone.length > 0 && !/^\+?\d{9,15}$/.test(inviteForm.phone.replace(/\s/g, "")) && (
 <p className="text-xs text-destructive">Enter a valid phone number (e.g. +256 7XX XXX XXX).</p>
 )}
 </div>

 <div className="space-y-1.5">
 <Label htmlFor="department">Department</Label>
 <Input
 id="department"
 value={inviteForm.department}
 onChange={(event) => setInviteForm((current) => ({ ...current, department: event.target.value }))}
 required
 />
 </div>

 <div className="space-y-1.5">
 <Label htmlFor="assigned-region">Assigned Region</Label>
 <Input
 id="assigned-region"
 value={inviteForm.assignedRegion}
 onChange={(event) => setInviteForm((current) => ({ ...current, assignedRegion: event.target.value }))}
 placeholder="Central Kampala"
 required
 />
 </div>

 <div className="space-y-1.5">
 <Label htmlFor="assigned-market">Assigned Market</Label>
 <Select value={inviteForm.marketId} onValueChange={handleMarketChange}>
 <SelectTrigger id="assigned-market">
 <SelectValue placeholder="Select market" />
 </SelectTrigger>
 <SelectContent>
 {markets.map((market) => (
 <SelectItem key={market.id} value={market.id}>
 {market.name}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-1.5">
 <Label htmlFor="access-level">Access Level</Label>
 <Select
 value={inviteForm.accessLevel}
 onValueChange={(value) => setInviteForm((current) => ({ ...current, accessLevel: value }))}
 >
 <SelectTrigger id="access-level">
 <SelectValue placeholder="Select access level" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="market_supervision">Market Supervision</SelectItem>
 <SelectItem value="regional_compliance">Regional Compliance</SelectItem>
 <SelectItem value="inspection_authority">Inspection Authority</SelectItem>
 <SelectItem value="read_only">Read Only</SelectItem>
 </SelectContent>
 </Select>
 </div>

 {inviteForm.role === "official" && (
 <div className="space-y-1.5 sm:col-span-2">
 <Label htmlFor="staff-id">Government ID / Staff ID</Label>
 <Input
 id="staff-id"
 value={inviteForm.staffIdentifier}
 onChange={(event) => setInviteForm((current) => ({ ...current, staffIdentifier: event.target.value }))}
 placeholder="GOV-KCCA-..."
 required
 />
 </div>
 )}
 </div>

 <div className="grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
 <div className="space-y-1.5">
 <Label htmlFor="responsibilities">Responsibilities</Label>
 <Textarea
 id="responsibilities"
 value={inviteForm.responsibilities}
 onChange={(event) => setInviteForm((current) => ({ ...current, responsibilities: event.target.value }))}
 className="min-h-[178px]"
 />
 <p className="text-xs text-muted-foreground">
 Temporary credentials are generated by the system and delivered through the invite.
 </p>
 </div>

 <div className="rounded-lg border border-border/70 bg-muted/10 p-3">
 <div className="flex items-center justify-between gap-3">
 <div>
 <p className="text-sm font-semibold">Permission Scope</p>
 <p className="mt-0.5 text-xs text-muted-foreground">
 Defaults are role-based; narrow the scope for stricter official access.
 </p>
 </div>
 <span className="rounded-full bg-background px-2 py-1 text-xs font-semibold text-muted-foreground">
 {inviteForm.permissions.length}
 </span>
 </div>

 <div className="mt-3 max-h-[260px] space-y-3 overflow-y-auto pr-1">
 {permissionGroups.map((group) => {
 const available = group.permissions.filter((permission) => rolePermissionMatrix[inviteForm.role].includes(permission));
 if (!available.length) return null;

 return (
 <div key={group.title}>
 <p className="section-eyebrow mb-1.5">
 {group.title}
 </p>
 <div className="grid gap-1.5">
 {available.map((permission) => (
 <label
 key={permission}
 className="flex items-start gap-2 rounded-lg border border-border/70 bg-background px-2.5 py-2 text-sm"
 >
 <Checkbox
 checked={inviteForm.permissions.includes(permission)}
 onCheckedChange={(checked) => togglePermission(permission, Boolean(checked))}
 className="mt-0.5"
 />
 <span className="min-w-0">
 <span className="block text-xs font-medium">{permissionLabels[permission]}</span>
 <span className="block font-mono text-[10px] text-muted-foreground">{permission}</span>
 </span>
 </label>
 ))}
 </div>
 </div>
 );
 })}
 </div>
 </div>
 </div>

 <DialogFooter>
 <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
 Cancel
 </Button>
 <Button type="submit" disabled={inviteMutation.isPending}>
 {inviteMutation.isPending ? "Sending invite..." : "Send Invite"}
 </Button>
 </DialogFooter>
 </form>
 </DialogContent>
 </Dialog>
 </ConsolePage>
 );
};

const UserScopeSheet = ({
 user,
 onClose,
}: {
 user: StaffAccount | null;
 onClose: () => void;
}) => (
 <DetailSheet
 open={Boolean(user)}
 onOpenChange={(open) => !open && onClose()}
 title={user?.name || "User scope"}
 description={user ? `${formatRole(user.role)} — ${user.marketName || user.assignedRegion || "Platform scope"}` : undefined}
 >
 {user && (
 <div className="space-y-4 text-sm">
 <div className="grid gap-3 sm:grid-cols-2">
 <div className="rounded-lg border border-border/70 bg-muted/15 p-2.5">
 <p className="text-xs text-muted-foreground">Role</p>
 <div className="mt-1"><span className={roleClassName(user.role)}>{formatRole(user.role)}</span></div>
 </div>
 <div className="rounded-lg border border-border/70 bg-muted/15 p-2.5">
 <p className="text-xs text-muted-foreground">Status</p>
 <div className="mt-1"><span className={statusClassName(user.status)}>{user.status.charAt(0).toUpperCase() + user.status.slice(1)}</span></div>
 </div>
 <div className="rounded-lg border border-border/70 bg-muted/15 p-2.5">
 <p className="text-xs text-muted-foreground">Email</p>
 <p className="mt-1 break-all font-medium">{user.email}</p>
 </div>
 <div className="rounded-lg border border-border/70 bg-muted/15 p-2.5">
 <p className="text-xs text-muted-foreground">Phone</p>
 <p className="mt-1 font-medium">{user.phone}</p>
 </div>
 <div className="rounded-lg border border-border/70 bg-muted/15 p-2.5">
 <p className="text-xs text-muted-foreground">Department</p>
 <p className="mt-1 font-medium">{user.department || "—"}</p>
 </div>
 <div className="rounded-lg border border-border/70 bg-muted/15 p-2.5">
 <p className="text-xs text-muted-foreground">Last Active</p>
 <p className="mt-1 font-medium">{getLastActiveLabel(user)}</p>
 </div>
 </div>

 <div className="rounded-lg border border-border/70 bg-muted/10 p-3">
 <div className="mb-3 flex items-center justify-between">
 <p className="text-sm font-semibold font-heading">Granted Permissions</p>
 <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
 {user.permissions.length}
 </span>
 </div>
 <div className="flex flex-wrap gap-1.5">
 {user.permissions.map((permission) => (
 <span
 key={permission}
 className="rounded-full border border-border/70 bg-background px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
 >
 {permission}
 </span>
 ))}
 </div>
 </div>

 {user.responsibilities.length > 0 && (
 <div className="rounded-lg border border-border/70 bg-muted/10 p-3">
 <p className="mb-2 text-sm font-semibold font-heading">Responsibilities</p>
 <ul className="space-y-1">
 {user.responsibilities.map((item) => (
 <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
 <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
 {item}
 </li>
 ))}
 </ul>
 </div>
 )}
 </div>
 )}
 </DetailSheet>
);

const UsersTable = ({ rows }: { rows: StaffAccount[] }) => {
 const [selectedUser, setSelectedUser] = useState<StaffAccount | null>(null);

 if (!rows.length) {
 return (
 <EmptyState
 title="No users found"
 description="Adjust the search or invite staff through the admin role-assignment workflow."
 />
 );
 }

 return (
 <>
 <DataTableFrame className="workspace-primary-frame">
 <Table>
 <TableHeader>
 <TableRow className="bg-muted/40">
 <TableHead>Name</TableHead>
 <TableHead>Role</TableHead>
 <TableHead>Department</TableHead>
 <TableHead>Status</TableHead>
 <TableHead>Last Active</TableHead>
 <TableHead className="text-right">Permissions</TableHead>
 <TableHead className="text-right">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {rows.map((account) => (
 <TableRow key={account.id} className="text-xs">
 <TableCell>
 <div className="min-w-[180px]">
 <p className="font-medium">{account.name}</p>
 <p className="mt-0.5 text-muted-foreground">{account.email}</p>
 </div>
 </TableCell>
 <TableCell>
 <span className={roleClassName(account.role)}>{formatRole(account.role)}</span>
 </TableCell>
 <TableCell>
 <div className="min-w-[150px]">
 <p className="font-medium">{account.department || (account.role === "vendor" ? "Vendor account" : "System")}</p>
 <p className="mt-0.5 text-muted-foreground">{account.marketName || account.assignedRegion || "Platform scope"}</p>
 </div>
 </TableCell>
 <TableCell>
 <span className={statusClassName(account.status)}>{account.status.charAt(0).toUpperCase() + account.status.slice(1)}</span>
 </TableCell>
 <TableCell className="text-muted-foreground">{getLastActiveLabel(account)}</TableCell>
 <TableCell className="text-right font-medium">{account.permissions.length}</TableCell>
 <TableCell className="text-right">
 <Button
 variant="ghost"
 size="sm"
 className="h-7 px-2 text-xs"
 onClick={() => setSelectedUser(account)}
 >
 View Scope
 </Button>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </DataTableFrame>

 {/* User scope detail sheet */}
 <UserScopeSheet user={selectedUser} onClose={() => setSelectedUser(null)} />
 </>
 );
};

const RolesPermissionsPanel = () => (
 <div className="grid gap-3 xl:grid-cols-[0.9fr_1.1fr]">
 <Panel
 title="Access Model"
 description="How roles and permissions decide what each staff member can access."
 contentClassName="space-y-2"
 >
 {[
 { label: "Authentication Layer", icon: KeyRound },
 { label: "Role Engine", icon: BadgeCheck },
 { label: "Permission Engine", icon: ShieldCheck },
 { label: "Dashboard Resolver", icon: Building2 },
 { label: "Module Access", icon: ClipboardList },
 ].map((item, index) => (
 <div key={item.label} className="flex items-center gap-3 rounded-lg border border-border/70 bg-background p-2.5">
 <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
 <item.icon className="h-3.5 w-3.5" />
 </span>
 <div className="min-w-0">
 <p className="text-sm font-medium">{item.label}</p>
 <p className="text-xs text-muted-foreground">Step {index + 1}</p>
 </div>
 </div>
 ))}
 </Panel>

 <DataTableFrame className="workspace-primary-frame" title="Role Permission Matrix" description="Current default scopes used by the invite workflow.">
 <Table>
 <TableHeader>
 <TableRow className="bg-muted/40">
 <TableHead>Role</TableHead>
 <TableHead>Access Intent</TableHead>
 <TableHead className="text-right">Permissions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {(Object.keys(rolePermissionMatrix) as Role[]).map((role) => (
 <TableRow key={role} className="text-xs">
 <TableCell>
 <span className={roleClassName(role)}>{formatRole(role)}</span>
 </TableCell>
 <TableCell>
 <div className="flex flex-wrap gap-1.5">
 {rolePermissionMatrix[role].slice(0, 6).map((permission) => (
 <span key={permission} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
 {permissionLabels[permission]}
 </span>
 ))}
 {rolePermissionMatrix[role].length > 6 && (
 <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
 +{rolePermissionMatrix[role].length - 6}
 </span>
 )}
 </div>
 </TableCell>
 <TableCell className="text-right font-medium">{rolePermissionMatrix[role].length}</TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </DataTableFrame>
 </div>
);

const ActivityPanel = ({ rows }: { rows: StaffAccount[] }) => {
 if (!rows.length) {
 return <EmptyState title="No activity logs" description="Staff onboarding and role events will appear here." />;
 }

 return (
 <div className="grid gap-2">
 {rows.slice(0, 12).map((account) => (
 <div key={account.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-background p-2.5">
 <div className="flex min-w-0 items-start gap-2.5">
 <span
 className={cn(
 "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
 account.lastActiveAt ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
 )}
 >
 <Activity className="h-3.5 w-3.5" />
 </span>
 <div className="min-w-0">
 <p className="truncate text-sm font-medium">{account.lastActiveAt ? "Recent account activity" : "Account invited"}</p>
 <p className="mt-0.5 truncate text-xs text-muted-foreground">
 {account.name} - {formatRole(account.role)} - {account.marketName || account.assignedRegion || "Platform scope"}
 </p>
 </div>
 </div>
 <p className="shrink-0 text-right text-xs text-muted-foreground">
 {formatHumanDateTime(account.lastActiveAt || account.createdAt)}
 </p>
 </div>
 ))}
 </div>
 );
};

export default UserManagementPage;
