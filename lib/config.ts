import "server-only";
import type { DisplaySettings } from "./types";

/**
 * Config is hard-coded rather than read from the environment, so the app runs
 * with no env setup. These values stay server-side: this module imports
 * "server-only" and is never pulled into a client bundle, so the browser never
 * sees the script URL or the admin credentials.
 */
export const config = {
  googleScriptUrl:
    "https://script.google.com/macros/s/AKfycbwR1n3HwHjVFlkCEd90RT03lNGGtEBxdgUKJ4pv0nG8uFYqk3ySNCHAXReni3YvZdDvHA/exec",
  adminPassword: "admin1234",
  authSecret:
    "6df7a5e5a532fcc76fec3e3aab34701b643f8deb780d657282e2e915e3f02764",
};

export const isSheetsConfigured = config.googleScriptUrl.length > 0;

/** Passed down to client components as props, since config is not readable there. */
export function displaySettings(): DisplaySettings {
  return {
    currency: "₹",
    timezone: "Asia/Kolkata",
    lowStockThreshold: 10,
    fallbackImage:
      "https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=900&q=80",
  };
}
