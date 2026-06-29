import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { Button } from "@/components/ui/button";
import Seo from "@/components/seo/Seo";

const Index = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const siteUrl = "https://mms-1.vercel.app";

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "MMS — Market Management System",
    url: siteUrl,
    logo: `${siteUrl}/images/mms-logo.svg`,
    description: "Premium market operations console for vendors, managers, officials, and administrators.",
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "MMS — Market Management System",
    url: siteUrl,
    description: "Premium market operations console for vendors, managers, officials, and administrators. Streamline stall allocation, billing, complaints, and revenue analytics.",
    applicationCategory: "BusinessApplication",
    operatingSystem: "All",
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    name: "MMS Breadcrumb",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl}/` },
      { "@type": "ListItem", position: 2, name: "Login", item: `${siteUrl}/login` },
      { "@type": "ListItem", position: 3, name: "Register", item: `${siteUrl}/register` },
    ],
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Seo
        title="Market Management System"
        description="Premium market operations console for vendors, managers, officials, and administrators. Streamline stall allocation, billing, complaints, and revenue analytics."
        jsonLd={[organizationSchema, websiteSchema, breadcrumbSchema]}
      />
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
          <button onClick={() => navigate("/")} className="flex items-center gap-2">
            <BrandLogo size="md" />
          </button>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
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
        {/* Hero */}
        <section className="relative overflow-hidden px-6 py-20 lg:py-32">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-blue-50" />

          <div className="relative mx-auto max-w-7xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
              <Sparkles className="h-3.5 w-3.5" />
              {t("landing:heroBadge")}
            </div>

            <h1 className="mx-auto max-w-4xl text-5xl font-bold tracking-tight text-slate-900 lg:text-7xl">
              {t("landing:heroTitle")}
              <span className="block text-emerald-600">{t("landing:heroTitleAccent")}</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
              {t("landing:heroSubtitle")}
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                onClick={() => navigate("/register")}
                className="bg-slate-900 text-white hover:bg-slate-800"
              >
                {t("landing:getStarted")}
                <ArrowRight className="ml-2 h-4 w-4" />
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
