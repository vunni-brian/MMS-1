import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  LayoutDashboard,
  Landmark,
  Plug,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const adminNavItems = [
  { path: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { path: "/admin/users", label: "Users", icon: Users },
  { path: "/admin/markets", label: "Markets", icon: Landmark },
  { path: "/admin/alerts", label: "System Health", icon: AlertTriangle },
  { path: "/admin/integrations", label: "Integrations", icon: Plug },
];

const AdminLayout = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-1 gap-6">
      <aside className="flex w-48 shrink-0 flex-col gap-1">
        {adminNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.end
            ? location.pathname === item.path
            : location.pathname.startsWith(item.path) && location.pathname !== "/admin";
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                isActive
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </aside>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
};

export default AdminLayout;
