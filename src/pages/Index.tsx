import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  CreditCard,
  MessageSquareText,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const publicLinks = [
  { label: "Features", target: "features" },
  { label: "Markets", target: "markets" },
  { label: "About", target: "about" },
  { label: "Contact", target: "contact" },
];

const featureCards = [
  {
    title: "Stall Management",
    detail: "Allocate stalls, track occupancy, and manage renewals.",
    icon: Store,
    tone: "text-emerald-700 bg-emerald-50 border-emerald-100",
  },
  {
    title: "Payments & Billing",
    detail: "Collect dues, verify receipts, and monitor arrears.",
    icon: CreditCard,
    tone: "text-blue-700 bg-blue-50 border-blue-100",
  },
  {
    title: "Complaints",
    detail: "Resolve vendor issues with clear ownership.",
    icon: MessageSquareText,
    tone: "text-violet-700 bg-violet-50 border-violet-100",
  },
  {
    title: "Reports & Audit",
    detail: "Review activity, compliance, and revenue signals.",
    icon: BarChart3,
    tone: "text-amber-700 bg-amber-50 border-amber-100",
  },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-950">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="WMMS home"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span className="text-base font-bold font-heading">WMMS</span>
        </button>

        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
          {publicLinks.map((item) => (
            <a key={item.label} href={`#${item.target}`} className="transition-colors hover:text-slate-950">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
            Login
          </Button>
          <Button size="sm" onClick={() => navigate("/register")}>
            Register
          </Button>
        </div>
      </header>

      <main>
        <section className="mx-auto grid min-h-[calc(100vh-76px)] w-full max-w-7xl items-center gap-8 px-4 pb-8 pt-3 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:px-8">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-800 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Unified market operations
            </div>
            <h1 className="max-w-xl text-4xl font-bold leading-tight font-heading tracking-normal text-slate-950 sm:text-5xl lg:text-6xl">
              Smarter Markets, Stronger Communities
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
              A unified platform for market managers, vendors, payment control, complaints, notices, and government oversight.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" onClick={() => navigate("/login")} className="gap-2">
                Login
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/register")}>
                Vendor Registration
              </Button>
            </div>
          </div>

          <div className="relative min-h-[360px] overflow-hidden rounded-lg border border-white bg-slate-200 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.75)] lg:min-h-[560px]">
            <img
              src="/images/market-hero.jpg"
              alt="Organized open-air market stalls"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-white/88 via-white/18 to-transparent" />
            <div className="absolute bottom-5 left-5 right-5 grid gap-3 sm:grid-cols-3">
              {[
                ["48", "Active markets"],
                ["2,156", "Registered users"],
                ["99.9%", "Service uptime"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-md border border-white/85 bg-white/95 p-3 shadow-sm backdrop-blur">
                  <p className="text-xl font-bold leading-none font-heading text-slate-950">{value}</p>
                  <p className="mt-1 text-xs font-medium text-slate-600">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="border-y border-slate-200 bg-white px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {featureCards.map((feature) => (
              <article key={feature.title} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <span className={`flex h-10 w-10 items-center justify-center rounded-md border ${feature.tone}`}>
                  <feature.icon className="h-5 w-5" />
                </span>
                <h2 className="mt-4 text-sm font-bold font-heading">{feature.title}</h2>
                <p className="mt-2 text-xs leading-5 text-slate-600">{feature.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="markets" className="mx-auto grid max-w-7xl gap-4 px-4 py-8 sm:px-6 lg:grid-cols-3 lg:px-8">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold font-heading">Built for every role</h2>
                <p className="mt-1 text-sm text-slate-600">Vendors, managers, officials, and administrators get focused workspaces.</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
            <ClipboardCheck className="h-5 w-5" />
            <h2 className="mt-3 text-sm font-bold font-heading">Accountable by default</h2>
            <p className="mt-2 text-xs leading-5 text-emerald-900/75">Receipts, approvals, notices, and audit trails stay visible from first review to final closure.</p>
          </div>
        </section>

        <section id="about" className="border-y border-slate-200 bg-white px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase text-primary">About WMMS</p>
              <h2 className="mt-2 text-2xl font-bold font-heading">Designed for market accountability</h2>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              WMMS connects stall records, vendor onboarding, collections, complaints, announcements, reports, and audit events so each role can act from the same operational source.
            </p>
          </div>
        </section>

        <footer id="contact" className="bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white/10">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <span className="font-bold font-heading">WMMS</span>
              </div>
              <p className="mt-3 max-w-lg text-sm leading-6 text-white/70">
                Unified software for efficient market management, transparent collections, and better service delivery.
              </p>
            </div>
            <div className="text-sm leading-7 text-white/70 md:text-right">
              <p>Email: support@wmms.co.ke</p>
              <p>Phone: +254 712 345 678</p>
              <p>Nairobi, Kenya</p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Index;
