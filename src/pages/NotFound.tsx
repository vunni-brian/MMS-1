import { useEffect } from "react";
import { ArrowLeft, Home, MapPinned, ShieldCheck } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const homePath = user ? `/${user.role}` : "/";

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[#f6f8fb] px-4 py-5 text-slate-950 sm:px-6 lg:px-8">
      <header className="mx-auto flex max-w-5xl items-center justify-between">
        <Link to="/" className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span className="font-bold font-heading">WMMS</span>
        </Link>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-82px)] max-w-5xl items-center gap-8 py-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section>
          <p className="text-[7rem] font-bold leading-none font-heading text-indigo-600 sm:text-[9rem]">404</p>
          <h1 className="mt-4 text-3xl font-bold font-heading">Page Not Found</h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
            The page you are looking for does not exist or has moved.
          </p>
          <p className="mt-4 w-fit rounded-md border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-600">
            {location.pathname}
          </p>
          <div className="mt-7 flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Button>
            <Button asChild className="gap-2">
              <Link to={homePath}>
                <Home className="h-4 w-4" />
                {user ? "Go to Dashboard" : "Go Home"}
              </Link>
            </Button>
          </div>
        </section>

        <section className="relative min-h-[340px] overflow-hidden rounded-lg border border-slate-200 bg-white p-8 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.55)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(79,70,229,0.12),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0),rgba(15,23,42,0.03))]" />
          <div className="relative mx-auto flex h-full max-w-sm flex-col items-center justify-center text-center">
            <span className="flex h-24 w-24 items-center justify-center rounded-full border border-indigo-100 bg-indigo-50 text-indigo-700">
              <MapPinned className="h-12 w-12" />
            </span>
            <div className="mt-8 grid w-full gap-3">
              <div className="h-12 rounded-md border border-slate-200 bg-slate-50" />
              <div className="mx-auto h-20 w-1 rounded-full bg-slate-300" />
              <div className="h-12 rounded-md border border-slate-200 bg-slate-50" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default NotFound;
