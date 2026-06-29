import { Helmet } from "react-helmet-async";
import { brand } from "@/config/brand";

export interface SeoProps {
  title?: string;
  description?: string;
  canonical?: string;
  noindex?: boolean;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  twitterCard?: "summary" | "summary_large_image";
  twitterSite?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  locale?: string;
}

const BASE_URL = brand.siteUrl;
const SITE_NAME = brand.ogTitle;
const DEFAULT_DESC = brand.ogDescription;
const DEFAULT_IMAGE = `${BASE_URL}${brand.ogImage}`;
const DEFAULT_TWITTER = brand.twitterSite;

const LOCALE_MAP: Record<string, string> = {
  en: "en_US",
  lg: "lg_UG",
  sw: "sw_KE",
};

const Seo = ({
  title,
  description = DEFAULT_DESC,
  canonical,
  noindex = false,
  ogTitle,
  ogDescription,
  ogImage = DEFAULT_IMAGE,
  ogType = "website",
  twitterCard = "summary_large_image",
  twitterSite = DEFAULT_TWITTER,
  jsonLd,
  locale = "en",
}: SeoProps) => {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const ogTitleFinal = ogTitle ?? fullTitle;
  const ogDescFinal = ogDescription ?? description;
  const ogImageFull = ogImage.startsWith("http") ? ogImage : `${BASE_URL}${ogImage}`;
  const canonicalUrl = canonical ?? (typeof window !== "undefined" ? `${BASE_URL}${window.location.pathname}` : BASE_URL);
  const htmlLocale = LOCALE_MAP[locale] || "en_US";

  const hreflangEntries = [
    { lang: "en", path: "" },
    { lang: "lg", path: "/lg" },
    { lang: "sw", path: "/sw" },
  ];

  return (
    <Helmet>
      <html lang={locale} />
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />

      {noindex && <meta name="robots" content="noindex, nofollow" />}
      {!noindex && <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />}

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={ogTitleFinal} />
      <meta property="og:description" content={ogDescFinal} />
      <meta property="og:image" content={ogImageFull} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content={ogType} />
      <meta property="og:locale" content={htmlLocale} />

      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:site" content={twitterSite} />
      <meta name="twitter:title" content={ogTitleFinal} />
      <meta name="twitter:description" content={ogDescFinal} />
      <meta name="twitter:image" content={ogImageFull} />

      <meta name="application-name" content={SITE_NAME} />
      <meta name="apple-mobile-web-app-title" content={SITE_NAME} />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="format-detection" content="telephone=no" />

      {hreflangEntries.map(({ lang, path }) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={`${BASE_URL}${path}${canonicalUrl.replace(BASE_URL, "")}`} />
      ))}
      <link rel="alternate" hrefLang="x-default" href={canonicalUrl} />

      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
};

export default Seo;
