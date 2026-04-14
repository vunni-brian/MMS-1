import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, SlidersHorizontal } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BillingPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, error } = useQuery({
    queryKey: ["charge-types", user?.role, user?.marketId || "all"],
    queryFn: () => api.getChargeTypes(user?.role === "manager" ? user.marketId || undefined : undefined),
    enabled: Boolean(user),
  });

  const updateChargeType = useMutation({
    mutationFn: ({ chargeTypeId, isEnabled }: { chargeTypeId: string; isEnabled: boolean }) =>
      api.updateChargeType(chargeTypeId, isEnabled),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["charge-types"] });
      await queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
  });

  const chargeTypes = data?.chargeTypes || [];
  const loadError = error instanceof ApiError ? error.message : error ? "Unable to load billing settings." : null;
  const canManage = user?.role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading">Billing Controls</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review which charge categories are currently active. Only admins can change these switches.
        </p>
      </div>

      {!canManage && (
        <Card className="card-warm border-info/20 bg-info/5">
          <CardContent className="flex items-start gap-3 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-info" />
            <div className="text-sm text-muted-foreground">
              This view is read-only for your role. Billing switches are controlled centrally by admins.
            </div>
          </CardContent>
        </Card>
      )}

      {loadError && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{loadError}</div>}

      <div className="grid gap-4 md:grid-cols-2">
        {chargeTypes.map((chargeType) => (
          <Card key={chargeType.id} className="card-warm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-heading">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                {chargeType.displayName}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Scope</p>
                  <p className="mt-1 font-medium capitalize">{chargeType.scope}</p>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className={`mt-1 font-medium ${chargeType.isEnabled ? "text-success" : "text-destructive"}`}>
                    {chargeType.isEnabled ? "Enabled" : "Disabled"}
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-muted/20 p-3 text-muted-foreground">
                Last updated by {chargeType.updatedByName || "system"} on {new Date(chargeType.updatedAt).toLocaleString()}.
              </div>

              <Button
                variant={chargeType.isEnabled ? "destructive" : "default"}
                disabled={!canManage || updateChargeType.isPending}
                onClick={() =>
                  updateChargeType.mutate({
                    chargeTypeId: chargeType.id,
                    isEnabled: !chargeType.isEnabled,
                  })
                }
              >
                {chargeType.isEnabled ? "Disable Charge Type" : "Enable Charge Type"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default BillingPage;
