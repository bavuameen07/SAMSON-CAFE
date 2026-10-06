import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { config } from "./config";
import { ApiError } from "./sheets";

const COOKIE_NAME = "samson_admin";
const SESSION_MAX_AGE_SECONDS = 6 * 60 * 60;

/**
 * Admin sessions are a signed, httpOnly cookie held by this app.
 *
 * The Apps Script admin key authorises the *API*; it never comes near the
 * browser. A request from the browser carries only this cookie, and the server
 * attaches the admin key itself when it calls the backend. That keeps the key out
 * of the client bundle, out of URLs and out of anything a customer can read,
 * while the cookie still guarantees that /admin is unreachable without signing
 * in.
 */

function signingSecret(): string {
  const secret = config.authSecret;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET is not set, so admin sessions cannot be signed and /admin is unavailable. Set AUTH_SECRET in .env.local and in Vercel — it must not be the admin key.",
    );
  }
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", signingSecret()).update(value).digest("hex");
}

function matches(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function verifySessionValue(value: string | undefined): boolean {
  if (!value) return false;
  const separator = value.indexOf(".");
  if (separator <= 0) return false;
  try {
    return matches(sign(value.slice(0, separator)), value.slice(separator + 1));
  } catch {
    // An unset AUTH_SECRET cannot sign anything, so there is no valid session to
    // accept. Returning false sends the visitor to /admin/login, which reports
    // the missing variable instead of showing a server error page.
    return false;
  }
}

export async function createAdminSession(): Promise<void> {
  const store = await cookies();
  const id = randomBytes(24).toString("hex");
  store.set(COOKIE_NAME, `${id}.${sign(id)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearAdminSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export const isAdminAuthenticated = cache(async (): Promise<boolean> => {
  const store = await cookies();
  return verifySessionValue(store.get(COOKIE_NAME)?.value);
});

/** Guard for server-rendered admin pages. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
}

/** Guard for server actions, which must not rely on the cookie being checked elsewhere. */
export async function assertAdmin(): Promise<void> {
  if (!(await isAdminAuthenticated())) {
    throw new ApiError("Your admin session has ended. Sign in again.");
  }
}

/**
 * Checks the submitted admin key against the configured one.
 *
 * Both sides are hashed with a fixed key before comparison and compared with
 * `timingSafeEqual`, so the check cannot be probed by response timing and the key
 * itself is never compared or stored directly.
 *
 * There is no fallback key: if `ADMIN_KEY` is unset this reports the missing
 * configuration rather than rejecting the sign-in as a wrong key, which would
 * send the operator looking for the wrong problem.
 */
export function adminKeyMatches(candidate: string): boolean {
  if (!config.adminKey) {
    throw new ApiError(
      "ADMIN_KEY is not set, so no admin key can be accepted. Set ADMIN_KEY in .env.local and in Vercel — it must match SAMSON_ADMIN_KEY in Apps Script.",
    );
  }
  return matches(hashKey(candidate), hashKey(config.adminKey));
}

function hashKey(value: string): string {
  return createHmac("sha256", "samson-cafe-admin-key").update(value, "utf8").digest("hex");
}
