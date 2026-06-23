import { Helmet } from "react-helmet-async";

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
  jsonLd?: Record<string, unknown>;
}

const BASE_URL = "https://mms-1.vercel.app";
const SITE_NAME = "MMS — Market Management System";
const DEFAULT_DESC = "Premium market operations console for vendors, managers, officials, and administrators.";
const DEFAULT_IMAGE = `${BASE_URL}/images/mms-logo.svg`;
const DEFAULT_TWITTER = "@KCCA";

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
}: SeoProps) => {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const ogTitleFinal = ogTitle ?? fullTitle;
  const ogDescFinal = ogDescription ?? description;
  const ogImageFull = ogImage.startsWith("http") ? ogImage : `${BASE_URL}${ogImage}`;
  const canonicalUrl = canonical ?? (typeof window !== "undefined" ? `${BASE_URL}${window.location.pathname}` : BASE_URL);

  return (
    <Helmet>
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
      <meta property="og:locale" content="en_US" />

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

      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
};

export default Seo;
