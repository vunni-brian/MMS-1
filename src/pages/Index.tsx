import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { BrandLogo } from "@/components/ui/BrandLogo";
import {
  ArrowRight,
  BarChart3,
  Bell,
  CheckCircle,
  ClipboardCheck,
  CreditCard,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const navLinkKeys = [
  { key: "features", target: "features" },
  { key: "process", target: "process" },
  { key: "reviews", target: "reviews" },
  { key: "pricing", target: "pricing" },
  { key: "faqs", target: "faqs" },
];

const features = [
  {
    title: "Smart Stall Allocation",
    detail: "AI-powered stall assignment based on vendor type, sales history, and market density.",
    icon: Store,
  },
  {
    title: "Automated Billing",
    detail: "Track dues, utilities, penalties, and send automated receipts with payment reconciliation.",
    icon: CreditCard,
  },
  {
    title: "Complaint Resolution",
    detail: "End-to-end complaint tracking from report to resolution with SLA monitoring.",
    icon: MessageSquareText,
  },
  {
    title: "Real-time Analytics",
    detail: "Market occupancy, revenue trends, and compliance dashboards for officials.",
    icon: BarChart3,
  },
];

const processSteps = [
  { step: "01", title: "Vendor Onboarding", description: "OTP verification and digital profile creation" },
  { step: "02", title: "Stall Assignment", description: "Automated allocation based on availability" },
  { step: "03", title: "Payment Setup", description: "Configure dues, utilities, and payment schedules" },
  { step: "04", title: "Daily Operations", description: "Manage complaints, notices, and renewals" },
];

const testimonials = [
  {
    name: "Sarah Nambi",
    role: "Vendor, Wandegeya Market",
    content: "MMS made paying my stall dues so easy. No more queues!",
    rating: 5,
  },
  {
    name: "John Mukasa",
    role: "Market Manager",
    content: "The analytics dashboard helps me track occupancy in real-time.",
    rating: 5,
  },
  {
    name: "Grace Auma",
    role: "KCCA Official",
    content: "Audit trails and compliance reporting are game-changing.",
    rating: 4.8,
  },
];

const faqs = [
  {
    q: "How do vendors register?",
    a: "Vendors register via OTP SMS verification and create their digital profile.",
  },
  {
    q: "Is MMS KCCA-compliant?",
    a: "Yes, MMS is built to meet KCCA market management standards.",
  },
  {
    q: "What payment methods are supported?",
    a: "Mobile money, bank transfers, and cash collections with digital receipts.",
  },
  {
    q: "Can officials access data remotely?",
    a: "Yes, cloud-based dashboard accessible from anywhere.",
  },
];

const Index = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Header - Clean like TabFlow */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2"
          >
            <BrandLogo size="md" />
          </button>

          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            {navLinkKeys.map((link) => (
              <a
                key={link.key}
                href={`#${link.target}`}
                className="transition-colors hover:text-slate-900"
              >
                {t(`landing:${link.key}`)}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/login")}
            >
              {t("auth:login")}
            </Button>
            <Button
              size="sm"
              className="bg-slate-900 text-white hover:bg-slate-800"
              onClick={() => navigate("/register")}
            >
              {t("landing:getStarted")}
              <ArrowRight className="ml-2 h-3 w-3" />
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section - Inspired by TabFlow */}
        <section className="relative overflow-hidden px-6 py-20 lg:py-32">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-blue-50" />
          
          <div className="relative mx-auto max-w-7xl text-center">
            {/* NEW Badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
              <Sparkles className="h-3.5 w-3.5" />
              {t("landing:heroBadge")}
            </div>

            {/* Headline */}
            <h1 className="mx-auto max-w-4xl text-5xl font-bold tracking-tight text-slate-900 lg:text-7xl">
              {t("landing:heroTitle")}
              <span className="block text-emerald-600">{t("landing:heroTitleAccent")}</span>
            </h1>

            {/* Subheadline */}
            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
              {t("landing:heroSubtitle")}
            </p>

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                onClick={() => navigate("/register")}
                className="bg-slate-900 text-white hover:bg-slate-800"
              >
                {t("landing:addToWorkspace")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-slate-300"
              >
                {t("landing:watchDemo")}
              </Button>
            </div>

            {/* Social Proof */}
            <div className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-600">
              <div className="flex text-emerald-500">
                {"★".repeat(5)}
              </div>
              <span className="font-medium">4.9</span>
              <span>| {t("landing:reviewsStat")}</span>
              <span>| {t("landing:usersStat")}</span>
              <span>| {t("landing:freeForever")}</span>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="border-t border-slate-100 bg-white px-6 py-20 scroll-mt-16">
          <div className="mx-auto max-w-7xl">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 lg:text-4xl">
                {t("landing:featuresTitle")}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-slate-600">
                {t("landing:featuresSubtitle")}
              </p>
            </div>

            <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <div key={feature.title} className="rounded-xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-lg">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-slate-900">{feature.title}</h3>
                  <p className="text-sm text-slate-600">{feature.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Process Section */}
        <section id="process" className="bg-slate-50 px-6 py-20 scroll-mt-16">
          <div className="mx-auto max-w-7xl">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 lg:text-4xl">
                {t("landing:processTitle")}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-slate-600">
                {t("landing:processSubtitle")}
              </p>
            </div>

            <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {processSteps.map((step) => (
                <div key={step.step} className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-700">
                    {step.step}
                  </div>
                  <h3 className="mb-2 font-semibold text-slate-900">{step.title}</h3>
                  <p className="text-sm text-slate-600">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Reviews Section */}
        <section id="reviews" className="bg-white px-6 py-20 scroll-mt-16">
          <div className="mx-auto max-w-7xl">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 lg:text-4xl">
                {t("landing:reviewsTitle")}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-slate-600">
                {t("landing:reviewsSubtitle")}
              </p>
            </div>

            <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((testimonial) => (
                <div key={testimonial.name} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-3 flex text-emerald-500">
                    {"★".repeat(Math.floor(testimonial.rating))}
                    {testimonial.rating % 1 !== 0 && "½"}
                  </div>
                  <p className="mb-4 text-slate-700">"{testimonial.content}"</p>
                  <div>
                    <p className="font-semibold text-slate-900">{testimonial.name}</p>
                    <p className="text-sm text-slate-500">{testimonial.role}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 text-center text-sm text-slate-500">
              {t("landing:reviewsAverage")}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="bg-slate-50 px-6 py-20 scroll-mt-16">
          <div className="mx-auto max-w-7xl">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 lg:text-4xl">
                {t("landing:pricingTitle")}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-slate-600">
                {t("landing:pricingSubtitle")}
              </p>
            </div>

            <div className="mt-16 grid gap-8 md:grid-cols-2 lg:mx-auto lg:max-w-3xl lg:grid-cols-2">
              {/* Free Plan */}
              <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
                <h3 className="text-xl font-semibold text-slate-900">{t("landing:freePlan")}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-slate-900">$0</span>
                  <span className="text-slate-600">{t("landing:perMonth")}</span>
                </div>
                <p className="mt-4 text-sm text-slate-600">{t("landing:freePlanDesc")}</p>
                <ul className="mt-6 space-y-3 text-sm">
                  {(t("landing:freePlanFeatures", { returnObjects: true }) as string[]).map((item: string) => (
                    <li key={item} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button className="mt-8 w-full border-slate-300" variant="outline">
                  {t("landing:getStarted")}
                </Button>
              </div>

              {/* Pro Plan */}
              <div className="rounded-xl border-2 border-emerald-500 bg-white p-8 shadow-lg">
                <div className="mb-2 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  {t("landing:popular")}
                </div>
                <h3 className="text-xl font-semibold text-slate-900">{t("landing:proPlan")}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-slate-900">$49</span>
                  <span className="text-slate-600">{t("landing:perMonth")}</span>
                </div>
                <p className="mt-4 text-sm text-slate-600">{t("landing:proPlanDesc")}</p>
                <ul className="mt-6 space-y-3 text-sm">
                  {(t("landing:proPlanFeatures", { returnObjects: true }) as string[]).map((item: string) => (
                    <li key={item} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button className="mt-8 w-full bg-slate-900 text-white hover:bg-slate-800">
                  {t("landing:startFreeTrial")}
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* FAQs Section */}
        <section id="faqs" className="bg-white px-6 py-20 scroll-mt-16">
          <div className="mx-auto max-w-4xl">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 lg:text-4xl">
                {t("landing:faqTitle")}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-slate-600">
                {t("landing:faqSubtitle")}
              </p>
            </div>

            <div className="mt-16 space-y-4">
              {faqs.map((faq) => (
                <details key={faq.q} className="group rounded-lg border border-slate-200 bg-white p-6">
                  <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-slate-900">
                    {faq.q}
                    <span className="ml-4 text-slate-400 group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <p className="mt-4 text-slate-600">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-20">
          <div className="mx-auto max-w-4xl text-center text-white">
            <h2 className="text-3xl font-bold lg:text-4xl">
              {t("landing:ctaTitle")}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-emerald-100">
              {t("landing:ctaSubtitle")}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                className="bg-white text-emerald-700 hover:bg-slate-100"
                onClick={() => navigate("/register")}
              >
                {t("landing:getStartedFree")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white text-white hover:bg-emerald-500"
              >
                {t("landing:contactSales")}
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <BrandLogo size="sm" />
            <div className="flex gap-6 text-sm text-slate-600">
              <a href="#features" className="hover:text-slate-900">{t("landing:features")}</a>
              <a href="#process" className="hover:text-slate-900">{t("landing:process")}</a>
              <a href="#reviews" className="hover:text-slate-900">{t("landing:reviews")}</a>
              <a href="#pricing" className="hover:text-slate-900">{t("landing:pricing")}</a>
              <a href="#faqs" className="hover:text-slate-900">{t("landing:faqs")}</a>
            </div>
            <div className="text-sm text-slate-500">
              {t("landing:copyright")}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;