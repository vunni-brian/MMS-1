import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Bell,
  ClipboardCheck,
  CreditCard,
  Landmark,
  MessageSquareText,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const publicLinks = [
  { label: "Workspaces", target: "workspaces" },
  { label: "Operations", target: "operations" },
  { label: "Governance", target: "governance" },
  { label: "Contact", target: "contact" },
];

const roleCards = [
  {
    title: "Vendor",
    detail: "Stall status, dues, complaints, notices, and profile updates.",
    icon: Store,
    tone: "text-emerald-700 bg-emerald-50 border-emerald-100",
  },
  {
    title: "Manager",
    detail: "Approvals, bookings, occupancy, payments, and daily market workflows.",
    icon: Users,
    tone: "text-blue-700 bg-blue-50 border-blue-100",
  },
  {
    title: "Official",
    detail: "Regional performance, compliance, audit activity, and escalations.",
    icon: BarChart3,
    tone: "text-indigo-700 bg-indigo-50 border-indigo-100",
  },
  {
    title: "Admin",
    detail: "Users, permissions, platform health, notifications, and audit logs.",
    icon: ShieldCheck,
    tone: "text-violet-700 bg-violet-50 border-violet-100",
  },
];

const operationCards = [
  { title: "Stall management", detail: "Availability, allocation, occupancy, and renewals.", icon: Store },
  { title: "Payments & billing", detail: "Dues, utilities, penalties, receipts, and reconciliation.", icon: CreditCard },
  { title: "Complaints", detail: "Clear ownership from report to resolution.", icon: MessageSquareText },
  { title: "Notifications", detail: "Role-aware notices and operational updates.", icon: Bell },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/86 backdrop-blur-xl">
        <div className="mx-auto flex h-[73px] w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            aria-label="MMS home"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-white">
              <Landmark className="h-5 w-5" />
            </span>
            <span className="min-w-0 text-left">
              <span className="block text-lg font-semibold leading-tight font-heading">MMS</span>
              <span className="hidden text-xs text-slate-500 sm:block">Market Management System</span>
            </span>
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
            <Button size="sm" className="bg-slate-950 text-white hover:bg-slate-800" onClick={() => navigate("/register")}>
              Register
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative min-h-[78svh] overflow-hidden">
          <img
            src="/images/market-hero.jpg"
            alt="Organized open-air market stalls"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-white/86" />
          <div className="relative mx-auto flex min-h-[78svh] max-w-7xl flex-col justify-center px-4 py-16 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Modern civic market operations
              </div>
              <h1 className="text-5xl font-semibold leading-tight tracking-tight text-slate-950 font-heading sm:text-6xl lg:text-7xl">
                MMS
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-700">
                A calm operational platform for vendor services, stall allocation, payments, complaints, reporting, and accountable market oversight.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" onClick={() => navigate("/login")} className="gap-2 bg-slate-950 text-white hover:bg-slate-800">
                  Open workspace
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" className="bg-white/90" onClick={() => navigate("/register")}>
                  Vendor registration
                </Button>
              </div>
              <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-600">
                {["Role-based dashboards", "Transparent payments", "Audit-ready workflows"].map((item) => (
                  <span key={item} className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 font-medium">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="workspaces" className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
          {roleCards.map((role) => (
            <article key={role.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl border ${role.tone}`}>
                <role.icon className="h-5 w-5" />
              </span>
              <h2 className="mt-5 text-lg font-semibold font-heading">{role.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{role.detail}</p>
            </article>
          ))}
        </section>

        <section id="operations" className="border-y border-slate-200 bg-white px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Operations</p>
              <h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-tight font-heading">Designed for fast scanning and daily work.</h2>
              <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600">
                MMS keeps each workflow focused, readable, and role-aware so teams can move from signal to action without crowded screens.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {operationCards.map((item) => (
                <article key={item.title} className="rounded-2xl border border-slate-200 bg-[#F7F8FA] p-5">
                  <item.icon className="h-5 w-5 text-slate-700" />
                  <h3 className="mt-4 text-sm font-semibold text-slate-950">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="governance" className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-3 lg:px-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                <ClipboardCheck className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold font-heading">Accountable by default</h2>
                <p className="mt-1 text-sm text-slate-600">Receipts, approvals, notices, and audit trails stay visible from review to closure.</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-3xl font-bold font-heading">99.9%</p>
            <p className="mt-2 text-sm text-slate-600">Target service availability for critical market workflows.</p>
          </div>
        </section>

        <footer id="contact" className="border-t border-slate-200 bg-white px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold text-slate-950">MMS</p>
              <p className="mt-1">Market Management System for modern civic operations.</p>
            </div>
            <div className="md:text-right">
              <p>support@mms.ug</p>
              <p>Kampala, Uganda</p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Index;
