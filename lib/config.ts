import "server-only";
import type { DisplaySettings } from "./types";

function readText(value: string | undefined, fallback = ""): string {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function readNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * GOOGLE_SCRIPT_URL and ADMIN_PASSWORD stay server-side. The browser never sees
 * either one, which is the main reason this replaced the old JSONP client.
 */
export const config = {
  googleScriptUrl: readText(process.env.GOOGLE_SCRIPT_URL),
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
  authSecret: readText(process.env.AUTH_SECRET),
};

export const isSheetsConfigured = config.googleScriptUrl.length > 0;

/** Passed down to client components as props, since env is not readable there. */
export function displaySettings(): DisplaySettings {
  return {
    currency: readText(process.env.CURRENCY, "₹"),
    timezone: readText(process.env.TIMEZONE, "Asia/Kolkata"),
    lowStockThreshold: readNumber(process.env.LOW_STOCK_THRESHOLD, 10),
    fallbackImage:
      "https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=900&q=80",
  };
}
