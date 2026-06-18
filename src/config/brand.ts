export interface BrandConfig {
  appName: string;
  tagline: string;
  logoPath: string;
  faviconPath: string;
  copyright: string;
  copyrightYear: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterSite: string;
}

export const brand: BrandConfig = {
  appName: "MMS",
  tagline: "Market Management",
  logoPath: "/favicon.png",
  faviconPath: "/favicon.png",
  copyright: "Kampala Capital City Authority",
  copyrightYear: "2026",
  ogTitle: "MMS — Market Management System",
  ogDescription: "Premium market operations console for vendors, managers, officials, and administrators.",
  ogImage: "/favicon.png",
  twitterSite: "@KCCA",
};
