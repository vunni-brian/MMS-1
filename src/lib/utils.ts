/**
 * Shared utility functions used across the application.
 * Includes class merging, formatting, and i18n helpers.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind class names using clsx and tailwind-merge.
 * @param inputs - Class values to merge.
 * @returns Merged class string.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Currency symbol used throughout the application. */
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

/**
 * Formats a numeric amount as a currency string.
 * @param amount - The amount to format.
 * @returns Formatted currency string (e.g. "UGX 1,500").
 */
export function formatCurrency(amount?: number | null) {
  return `${CURRENCY_SYMBOL} ${(amount || 0).toLocaleString(undefined)}`;
}

/**
 * Formats a date value into a human-readable date string.
 * @param value - The date to format (string, Date, or null).
 * @param fallback - Fallback text when the date is invalid.
 * @returns Formatted date string or fallback.
 */
export function formatHumanDate(value?: string | Date | null, fallback = "Not available") {
  const date = parseDate(value);
  return date ? dateFormatter().format(date) : fallback;
}

/**
 * Formats a date value into a human-readable date-time string.
 * @param value - The date to format (string, Date, or null).
 * @param fallback - Fallback text when the date is invalid.
 * @returns Formatted date-time string or fallback.
 */
export function formatHumanDateTime(value?: string | Date | null, fallback = "Not available") {
  const date = parseDate(value);
  return date ? shortDateTimeFormatter().format(date) : fallback;
}

/**
 * Returns a time-aware greeting based on the current hour.
 * @param t - i18n translation function.
 * @param name - Optional name to include in the greeting.
 * @returns Localized greeting string (e.g. "Good morning, John").
 */
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

/**
 * Translates a snake_case value using i18n, falling back to a readable form.
 * @param t - i18n translation function.
 * @param value - The snake_case string to translate.
 * @param prefix - i18n namespace prefix (default "common").
 * @returns Translated or fallback string.
 */
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
