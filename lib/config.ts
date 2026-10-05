import "server-only";
import type { DisplaySettings } from "./types";

/**
 * Config is hard-coded rather than read from the environment, so the app runs
 * with no env setup. These values stay server-side: this module imports
 * "server-only" and is never pulled into a client bundle, so the browser never
 * sees the script URL or the admin credentials.
 *
 * The one exception is the web app URL. Redeploying Apps Script produces a new
 * URL, so `GOOGLE_SCRIPT_URL` lets a hosting platform supply it without a source
 * edit; the hard-coded value below stays the default.
 */
export const config = {
  googleScriptUrl:
    process.env.GOOGLE_SCRIPT_URL ??
    "https://script.google.com/macros/s/AKfycbwR1n3HwHjVFlkCEd90RT03lNGGtEBxdgUKJ4pv0nG8uFYqk3ySNCHAXReni3YvZdDvHA/exec",
  adminPassword: "admin1234",
  authSecret:
    "6df7a5e5a532fcc76fec3e3aab34701b643f8deb780d657282e2e915e3f02764",

  /**
   * Where a product with no picture in the sheet gets one from.
   *
   * `endpoint` must accept `{prompt}` plus the usual image-generator query
   * parameters; `model` selects the image model. The prompt is derived from the
   * product name (see lib/product-image-prompts.ts) and the request seed is
   * derived from that prompt's dish signature, so the same product name always
   * resolves to the same image. Set `enabled: false` to serve only the photos
   * committed in `public/menu`.
   */
  imageGenerator: {
    enabled: true,
    endpoint: "https://image.pollinations.ai/prompt/{prompt}",
    model: "flux",
    /**
     * Bearer token for the `npm run images` tool, for generator accounts that
     * need one. The browser never sends it — anything the client can read is
     * public — so a token-authenticated generator can only be used to produce
     * the committed photos, not to resolve images at request time.
     */
    token: "",
  },

  /**
   * Shown when a product has no picture at all. Self-hosted, so the site never
   * depends on a third-party host for its fallback.
   */
  fallbackImage: "/menu/fallback.jpg",
};

export const isSheetsConfigured = config.googleScriptUrl.length > 0;

/** Passed down to client components as props, since config is not readable there. */
export function displaySettings(): DisplaySettings {
  return {
    currency: "₹",
    timezone: "Asia/Kolkata",
    lowStockThreshold: 10,
    fallbackImage: config.fallbackImage,
  };
}
