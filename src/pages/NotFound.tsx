import { useEffect } from "react";
import { ArrowLeft, Home, Landmark, MapPinned, ShieldCheck } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const homePath = user ? `/${user.role}` : "/";

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.warn("[MMS] 404: User navigated to non-existent route:", location.pathname);
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F3F4F6] text-slate-900 font-sans">
      {/* Official Top Bar */}
      <div className="bg-primary px-4 py-2 text-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between text-xs font-medium">
          <div className="flex items-center gap-2">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-primary">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
            </span>
            {t("error:portalTitle")}
          </div>
        </div>
      </div>

      <header className="mx-auto flex max-w-5xl items-center justify-between py-4">
        <Link to="/" className="flex items-center gap-4 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <div className="flex h-12 w-12 items-center justify-center bg-primary text-white">
            <Landmark className="h-6 w-6" />
          </div>
          <div className="text-left">
            <span className="block text-xl font-bold leading-tight text-slate-900 tracking-tight">{t("error:brand")}</span>
            <span className="block text-xs font-medium text-slate-500 uppercase tracking-wider">{t("error:brandSub")}</span>
          </div>
        </Link>
      </header>

      <main className="mx-auto grid flex-1 w-full max-w-5xl items-center gap-8 px-4 py-8 sm:px-6 lg:px-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section>
          <p className="text-[7rem] font-bold leading-none font-heading text-indigo-600 sm:text-[9rem]">404</p>
          <h1 className="mt-4 text-3xl font-bold font-heading">{t("error:notFound")}</h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
            {t("error:notFoundDesc")}
          </p>
          <p className="mt-4 w-fit rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-600">
            {location.pathname}
          </p>
          <div className="mt-7 flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t("common:back")}
            </Button>
            <Button asChild className="gap-2">
              <Link to={homePath}>
                <Home className="h-4 w-4" />
                {user ? t("error:goDashboard") : t("error:goHome")}
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
              <div className="h-12 rounded-lg border border-slate-200 bg-slate-50" />
              <div className="mx-auto h-20 w-1 rounded-full bg-slate-300" />
              <div className="h-12 rounded-lg border border-slate-200 bg-slate-50" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default NotFound;
