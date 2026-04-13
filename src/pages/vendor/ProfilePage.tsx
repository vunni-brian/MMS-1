import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, FileText, Mail, MapPinned, Phone, User } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError, formatAttachmentLabel } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";

const ProfilePage = () => {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    marketId: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["vendor-profile", user?.id],
    queryFn: () => api.getVendor(user!.id),
    enabled: Boolean(user?.id),
  });
  const { data: marketsData } = useQuery({
    queryKey: ["markets", "profile"],
    queryFn: () => api.getMarkets(),
  });

  useEffect(() => {
    if (!user) {
      return;
    }

    setForm({
      name: user.name,
      email: user.email,
      phone: user.phone,
      marketId: user.marketId || "",
    });
  }, [user]);

  const updateProfile = useMutation({
    mutationFn: () =>
      api.updateVendorProfile(user!.id, {
        name: form.name,
        email: form.email,
        phone: form.phone,
        marketId: form.marketId,
      }),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["vendor-profile", user?.id] });
      await queryClient.invalidateQueries({ queryKey: ["markets"] });
      await refreshUser();
      setMessage(response.message);
      setError(null);
    },
    onError: (mutationError) => {
      setMessage(null);
      setError(mutationError instanceof ApiError ? mutationError.message : "Unable to update profile.");
    },
  });

  if (!user) return null;
  const vendor = data?.vendor;
  const markets = marketsData?.markets || [];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold font-heading">My Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Update your contact details or request a transfer to another market.
        </p>
      </div>

      <Card className="card-warm">
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-heading">{user.name}</h2>
              {user.vendorStatus && <StatusBadge status={user.vendorStatus} />}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div>
                <span className="text-muted-foreground">Registered</span>
                <p className="font-medium">{user.createdAt}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <MapPinned className="w-4 h-4 text-muted-foreground" />
              <div>
                <span className="text-muted-foreground">Current Market</span>
                <p className="font-medium">{user.marketName || "Not assigned"}</p>
              </div>
            </div>
            {vendor?.idDocument && (
              <div className="md:col-span-2 flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <div>
                  <span className="text-muted-foreground">ID Document</span>
                  <p className="font-medium">{formatAttachmentLabel(vendor.idDocument)}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="card-warm">
        <CardContent className="p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="profile-name">Full Name</Label>
              <Input
                id="profile-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="profile-email"
                  type="email"
                  className="pl-9"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="profile-phone"
                  className="pl-9"
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-market">Preferred Market</Label>
              <Select value={form.marketId} onValueChange={(value) => setForm((current) => ({ ...current, marketId: value }))}>
                <SelectTrigger id="profile-market">
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
          </div>

          <div className="rounded-xl border border-warning/20 bg-warning/5 p-4 text-sm text-muted-foreground">
            Changing markets triggers manager review again and is blocked while you still have an active stall.
          </div>

          {message && <div className="rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">{message}</div>}
          {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>}

          <Button
            onClick={() => updateProfile.mutate()}
            disabled={
              updateProfile.isPending ||
              !form.name.trim() ||
              !form.email.trim() ||
              !form.phone.trim() ||
              !form.marketId
            }
          >
            {updateProfile.isPending ? "Saving Changes..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePage;
