import { toNumber } from "./coerce";

export function formatMoney(value: number, currency: string): string {
  return `${currency}${toNumber(value).toLocaleString("en-IN")}`;
}

/**
 * Parses a timestamp from the Orders sheet.
 *
 * The sheet stores `DD-MM-YYYY HH:mm:ss`, which `new Date()` cannot read — it is
 * not ISO and the day comes first. Passing the raw string straight through would
 * make every date render as unformatted text and would silently break the date
 * filter and the newest-first sort, so it is converted here once.
 *
 * The parts are read as cafe-local wall-clock time rather than converted through
 * UTC, because that is what the sheet records and what the cafe owner expects to
 * read back.
 */
export function parseSheetDate(value: string): Date | null {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const match = text.match(
    /^(\d{1,2})-(\d{1,2})-(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (match) {
    const [, day, month, year, hour, minute, second] = match;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second ?? "0"),
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // Anything else (an ISO string, say) is still worth trying.
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDate(value: string | Date): Date | null {
  return value instanceof Date ? (Number.isNaN(value.getTime()) ? null : value) : parseSheetDate(value);
}

/** Renders a stored timestamp in the cafe's timezone. */
export function formatDateTime(value: string, timezone: string): string {
  const date = toDate(value);
  if (!date) return String(value ?? "");
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  });
}

export function formatDay(value: string, timezone: string): string {
  const date = toDate(value);
  if (!date) return String(value ?? "");
  return date.toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: timezone });
}

/** YYYY-MM-DD in the cafe's timezone, for matching against <input type="date">. */
export function isoDay(value: string | Date, timezone: string): string {
  const date = toDate(value);
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

/** Sort key for order timestamps; unparseable dates sort last. */
export function dateValue(value: string): number {
  return toDate(value)?.getTime() ?? 0;
}
