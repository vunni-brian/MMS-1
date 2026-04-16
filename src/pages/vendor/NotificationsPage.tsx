import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CreditCard, Grid3X3, MessageSquare, Settings } from "lucide-react";

import { api } from "@/lib/api";
import { formatHumanDateTime } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

const iconMap = {
  otp: Settings,
  payment: CreditCard,
  booking: Grid3X3,
  complaint: MessageSquare,
  system: Bell,
};

const typeLabels = {
  otp: "Security",
  payment: "Payment",
  booking: "Booking",
  complaint: "Complaint",
  system: "System",
};

const NotificationsPage = () => {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.getNotifications(),
  });

  const markRead = useMutation({
    mutationFn: (notificationId: string) => api.markNotificationRead(notificationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const notifications = data?.notifications || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading">Notifications</h1>
        <p className="text-muted-foreground text-sm mt-1">Your recent alerts and updates</p>
      </div>

      <div className="space-y-2">
        {notifications.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No notifications</p>
        ) : (
          notifications.map((notification) => {
            const Icon = iconMap[notification.type];
            return (
              <Card
                key={notification.id}
                className={`card-warm cursor-pointer ${!notification.read ? "border-primary/30 bg-primary/5" : ""}`}
                onClick={() => {
                  if (!notification.read) {
                    markRead.mutate(notification.id);
                  }
                }}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${!notification.read ? "bg-primary/10" : "bg-muted"}`}>
                    <Icon className={`w-4 h-4 ${!notification.read ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="status-badge border-primary/15 bg-primary/10 text-primary">{typeLabels[notification.type]}</span>
                      <span className="text-xs text-muted-foreground">{formatHumanDateTime(notification.createdAt)}</span>
                    </div>
                    <p className={`text-sm whitespace-pre-line ${!notification.read ? "font-medium" : ""}`}>{notification.message}</p>
                  </div>
                  {!notification.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
