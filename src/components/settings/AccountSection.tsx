import { Activity, Building2, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/console/ConsolePage";
import { ReadOnlyRows } from "@/components/settings";
import { StatusBadge } from "@/components/StatusBadge";
import { formatHumanDate } from "@/lib/utils";
import type { AuthUser, Role } from "@/types";

const roleLabels: Record<Role, string> = {
  vendor: "Vendor",
  manager: "Manager",
  official: "Official",
  admin: "Admin",
};

interface AccountSectionProps {
  user: AuthUser;
  navigate: (path: string) => void;
  roleHomePath: string;
  setActiveSection: (id: string) => void;
  deactivationState: "idle" | "confirm" | "submitting" | "done" | "error";
  setDeactivationState: (state: "idle" | "confirm" | "submitting" | "done" | "error") => void;
  onRequestDeactivation: () => void;
}

const AccountSection = ({
  user,
  navigate,
  roleHomePath,
  setActiveSection,
  deactivationState,
  setDeactivationState,
  onRequestDeactivation,
}: AccountSectionProps) => (
  <div className="space-y-4">
    <Panel
      title="Account Overview"
      description="Profile identity remains editable on the Profile page. Settings shows account state, access scope, and verification."
      actions={<UserCircle className="h-4 w-4 text-muted-foreground" />}
    >
      <ReadOnlyRows
        rows={[
          { label: "Account holder", value: user.name },
          { label: "Email", value: user.email },
          { label: "Phone", value: user.phone },
          { label: "Role", value: roleLabels[user.role] },
          { label: "Market scope", value: user.marketName || (user.role === "admin" ? "All markets" : "No market assigned") },
          {
            label: "Phone verification",
            value: user.phoneVerifiedAt ? `Verified ${formatHumanDate(user.phoneVerifiedAt)}` : "Pending",
          },
          {
            label: "Status",
            value: user.vendorStatus ? <StatusBadge status={user.vendorStatus} /> : "Active",
          },
        ]}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => navigate(`${roleHomePath}/profile`)}>
          <UserCircle className="h-4 w-4" />
          Edit Profile
        </Button>
        <Button type="button" variant="outline" onClick={() => setActiveSection("activity")}>
          <Activity className="h-4 w-4" />
          View Activity
        </Button>
      </div>
    </Panel>

    {user.role === "vendor" && (
      <Panel
        title="Vendor Account"
        description="Market assignment and account lifecycle controls for the vendor workspace."
        actions={<Building2 className="h-4 w-4 text-muted-foreground" />}
      >
        <ReadOnlyRows
          rows={[
            { label: "Current market", value: user.marketName || "Pending manager assignment" },
            { label: "Product section", value: user.productSection || "Recorded on vendor profile" },
            { label: "Transfer handling", value: "Market transfer requests require manager approval" },
          ]}
        />
        <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
          <p className="text-sm font-semibold text-destructive">Deactivate account</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Deactivation requests should be reviewed by market staff before stall access is released.
          </p>
          {deactivationState === "done" ? (
            <p className="mt-3 text-xs text-success font-medium">Request submitted. Market staff will contact you to complete the process.</p>
          ) : deactivationState === "error" ? (
            <p className="mt-3 text-xs text-destructive font-medium">Failed to submit request. Please try again or contact your market office directly.</p>
          ) : deactivationState === "confirm" ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-semibold text-destructive">Are you sure? This will notify market staff to begin the deactivation process.</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={deactivationState === "submitting"}
                  onClick={() => { setDeactivationState("submitting"); onRequestDeactivation(); }}
                >
                  Yes, submit request
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setDeactivationState("idle")}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="mt-3 text-destructive hover:text-destructive"
              onClick={() => setDeactivationState("confirm")}
            >
              Request Deactivation
            </Button>
          )}
        </div>
      </Panel>
    )}
  </div>
);

export default AccountSection;
