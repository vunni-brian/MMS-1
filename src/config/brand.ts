/** Branding configuration for the application. */
export interface BrandConfig {
  /** Display name of the application. */
  appName: string;
  /** Short tagline describing the app. */
  tagline: string;
  /** Path to the logo image. */
  logoPath: string;
  /** Path to the favicon image. */
  faviconPath: string;
  /** Copyright holder text. */
  copyright: string;
  /** Copyright year displayed in the footer. */
  copyrightYear: string;
  /** Open Graph title for social sharing. */
  ogTitle: string;
  /** Open Graph description for social sharing. */
  ogDescription: string;
  /** Open Graph image URL for social sharing. */
  ogImage: string;
  /** Twitter handle for the organisation. */
  twitterSite: string;
}

/**
 * Default brand configuration values.
 * Used across the app for headers, meta tags, and footers.
 */
export const brand: BrandConfig = {
  appName: "MMS",
  tagline: "Market Management",
  logoPath: "/favicon.png",
  faviconPath: "/favicon.png",
  copyright: "Wandegeya Market Authority",
  copyrightYear: "2026",
  ogTitle: "MMS — Market Management System",
  ogDescription: "Premium market operations console for vendors, managers, officials, and administrators.",
  ogImage: "/favicon.png",
  twitterSite: "@KCCA",
};
