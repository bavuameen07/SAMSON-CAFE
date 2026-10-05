import { toNumber } from "./coerce";

export function formatMoney(value: number, currency: string): string {
  return `${currency}${toNumber(value).toLocaleString("en-IN")}`;
}

/** Renders a stored timestamp in the cafe's timezone rather than the server's. */
export function formatDateTime(value: string, timezone: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  });
}

export function formatDay(value: string, timezone: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: timezone });
}

/** YYYY-MM-DD in the cafe's timezone, for matching against <input type="date">. */
export function isoDay(value: string | Date, timezone: string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}
