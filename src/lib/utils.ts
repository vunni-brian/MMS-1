import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const shortDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
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
  return `UGX ${(amount || 0).toLocaleString("en-US")}`;
}

export function formatHumanDate(value?: string | Date | null, fallback = "Not available") {
  const date = parseDate(value);
  return date ? dateFormatter.format(date) : fallback;
}

export function formatHumanDateTime(value?: string | Date | null, fallback = "Not available") {
  const date = parseDate(value);
  return date ? shortDateTimeFormatter.format(date) : fallback;
}

export function formatHumanDateRange(start?: string | Date | null, end?: string | Date | null) {
  const startDate = parseDate(start);
  const endDate = parseDate(end);

  if (!startDate && !endDate) return "Dates not set";
  if (!startDate) return `Until ${dateFormatter.format(endDate!)}`;
  if (!endDate) return `From ${dateFormatter.format(startDate)}`;

  if (startDate.getFullYear() === endDate.getFullYear()) {
    const compactStart = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
    }).format(startDate);

    return `${compactStart} -> ${dateFormatter.format(endDate)}`;
  }

  return `${dateFormatter.format(startDate)} -> ${dateFormatter.format(endDate)}`;
}

export function getTimeAwareGreeting(name?: string | null) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return `${greeting}, ${name || "there"}`;
}
