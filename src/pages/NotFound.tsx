import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, ArrowLeft } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const homePath = user ? `/${user.role}` : "/";

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="text-center space-y-4 max-w-sm">
        <p className="text-7xl font-bold font-heading text-muted-foreground/30">404</p>
        <h1 className="text-xl font-semibold font-heading">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          The page at <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{location.pathname}</span> doesn't exist or you don't have access to it.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center pt-2">
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
          <Button asChild className="gap-2">
            <Link to={homePath}>
              <Home className="h-4 w-4" />
              {user ? "Back to Dashboard" : "Go Home"}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
