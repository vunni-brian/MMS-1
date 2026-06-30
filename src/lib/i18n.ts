/**
 * i18next initialisation and configuration.
 * Supports English (en), Luganda (lg), and Swahili (sw).
 * Language is detected from localStorage first, then the browser navigator.
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "@/locales/en.json";
import lg from "@/locales/lg.json";
import sw from "@/locales/sw.json";

const storedLang = typeof window !== "undefined" ? localStorage.getItem("i18nextLng") : null;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { ...en },
      lg: { ...lg },
      sw: { ...sw },
    },
    ns: Object.keys(en),
    defaultNS: "common",
    fallbackLng: "en",
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "i18nextLng",
    },
    interpolation: {
      // Intentional: React JSX auto-escapes all text content by default.
      // Setting escapeValue=true would double-escape (e.g. apostrophes in
      // translation values would render as &#39;). If you ever add
      // dangerouslySetInnerHTML near a t() call, you MUST re-enable this.
      escapeValue: false,
      prefix: "{",
      suffix: "}",
    },
  });

if (storedLang && storedLang !== i18n.language) {
  i18n.changeLanguage(storedLang);
}

i18n.on("languageChanged", (lng) => {
  localStorage.setItem("i18nextLng", lng);
});

export default i18n;
