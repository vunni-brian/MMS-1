import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
 return twMerge(clsx(inputs));
}

export const CURRENCY_SYMBOL = "UGX";

const dateFormatter = () => new Intl.DateTimeFormat(undefined, {
 day: "2-digit",
 month: "short",
 year: "numeric",
});

const shortDateTimeFormatter = () => new Intl.DateTimeFormat(undefined, {
 day: "2-digit",
 month: "short",
 year: "numeric",
 hour: "2-digit",
 minute: "2-digit",
});

const parseDate = (value?: string | Date | null) => {
 if (!value) return null;
 const date = value instanceof Date ? value : new Date(value);
 return Number.isNaN(date.getTime()) ? null : date;
};

export function formatCurrency(amount?: number | null) {
 return `${CURRENCY_SYMBOL} ${(amount || 0).toLocaleString(undefined)}`;
}

export function formatHumanDate(value?: string | Date | null, fallback = "Not available") {
 const date = parseDate(value);
 return date ? dateFormatter().format(date) : fallback;
}

export function formatHumanDateTime(value?: string | Date | null, fallback = "Not available") {
 const date = parseDate(value);
 return date ? shortDateTimeFormatter().format(date) : fallback;
}

export function getTimeAwareGreeting(
  t: (key: string) => string,
  name?: string | null,
) {
  const hour = new Date().getHours();
  const greeting = hour < 12
    ? t("common:goodMorning")
    : hour < 18
      ? t("common:goodAfternoon")
      : t("common:goodEvening");
  return `${greeting}, ${name || t("common:greetingThere")}`;
}

function snakeToCamel(s: string): string {
  return s
    .toLowerCase()
    .replace(/_(.)/g, (_, c) => c.toUpperCase());
}

export function tSnake(
  t: (key: string) => string,
  value: string,
  prefix = "common",
): string {
  const camel = snakeToCamel(value);
  const key = `${prefix}:${camel}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return value.replace(/_/g, " ").toLowerCase();
}
