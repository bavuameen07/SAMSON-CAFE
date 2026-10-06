import "server-only";
import type { DisplaySettings } from "./types";

/**
 * Values are read from the environment here rather than inlined at each use site.
 *
 * The admin credentials have **no built-in default on purpose**. An earlier
 * revision committed both the admin key and the cookie-signing secret as
 * fallbacks, which meant anyone holding the repository could sign in to `/admin`
 * and forge an admin session cookie outright. Both now come from the environment
 * only, and `lib/admin-session.ts` and `lib/sheets.ts` fail loudly with setup
 * instructions when they are missing rather than quietly falling back to
 * something weak.
 *
 * These are deliberately NOT `NEXT_PUBLIC_` variables. This module imports
 * "server-only" and is never pulled into a client bundle, so the browser never
 * sees the script URL, the admin key or the session secret. Only
 * `displaySettings()` below crosses the boundary, and it carries no secrets.
 */
export const config = {
  /**
   * The deployed Apps Script web app. This is the single endpoint the whole app
   * talks to — customer menu, checkout and every admin page.
   *
   * `GOOGLE_SCRIPT_URL` wins when set; the literal below is the fallback so the
   * public storefront still works with no env file at all. Redeploying Apps
   * Script issues a new URL, so putting it in `.env.local` (and in Vercel) means
   * a redeploy never needs a source edit.
   */
  googleScriptUrl:
    process.env.GOOGLE_SCRIPT_URL ??
    "https://script.google.com/macros/s/AKfycbzqnhSZiR3vtvBa7luyGjr9GPGlkqFP7s1b-aEAYc9nmMkf-7zXuXZ2TXRkBsFzedEARw/exec",

  /**
   * The admin key the Apps Script expects on every admin action. Required.
   *
   * This module imports "server-only" and is never pulled into a client bundle,
   * so the key never reaches the browser. Every admin call is made from a server
   * component or a server action, which appends this key itself — no admin
   * request is ever built in the client.
   *
   * Set `ADMIN_KEY` on Vercel and in `.env.local`. It must match
   * `SAMSON_ADMIN_KEY` in the Apps Script project's Script properties, or every
   * admin request is refused with "Unauthorized admin request".
   */
  adminKey: process.env.ADMIN_KEY ?? "",

  /**
   * Signs the admin session cookie, which is what actually protects /admin.
   * Required.
   *
   * The Apps Script key authorises the API; this secret authorises the browser.
   * It is deliberately not allowed to fall back to the admin key: reusing the API
   * credential for cookie signing would mean one leaked value opens both doors.
   * Changing it signs existing admins out.
   */
  authSecret: process.env.AUTH_SECRET ?? "",


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
