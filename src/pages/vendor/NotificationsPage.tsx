import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CreditCard, Grid3X3, MessageSquare, Settings } from "lucide-react";

import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";

const iconMap = {
  otp: Settings,
  payment: CreditCard,
  booking: Grid3X3,
  complaint: MessageSquare,
  system: Bell,
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
                className={`card-warm cursor-pointer ${!notification.read ? "border-primary/30" : ""}`}
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
                    <p className={`text-sm ${!notification.read ? "font-medium" : ""}`}>{notification.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(notification.createdAt).toLocaleString()}</p>
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
