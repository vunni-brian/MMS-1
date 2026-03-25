import { useQuery } from "@tanstack/react-query";
import { Calendar, FileText, Mail, MapPinned, Phone, User } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, formatAttachmentLabel } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";

const ProfilePage = () => {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["vendor-profile", user?.id],
    queryFn: () => api.getVendor(user!.id),
    enabled: Boolean(user?.id),
  });
  if (!user) return null;
  const vendor = data?.vendor;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold font-heading">My Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">Your account information</p>
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

          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <div><span className="text-muted-foreground">Phone</span><p className="font-medium">{user.phone}</p></div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <div><span className="text-muted-foreground">Email</span><p className="font-medium">{user.email}</p></div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div><span className="text-muted-foreground">Registered</span><p className="font-medium">{user.createdAt}</p></div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <MapPinned className="w-4 h-4 text-muted-foreground" />
              <div><span className="text-muted-foreground">Market</span><p className="font-medium">{user.marketName || "Not assigned"}</p></div>
            </div>
            {vendor?.idDocument && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <div><span className="text-muted-foreground">ID Document</span><p className="font-medium">{formatAttachmentLabel(vendor.idDocument)}</p></div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePage;
