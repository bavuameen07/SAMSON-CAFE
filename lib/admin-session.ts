import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { config } from "./config";
import { requestAdminToken, SheetsError } from "./sheets";

const COOKIE_NAME = "samson_admin";
const SESSION_MAX_AGE_SECONDS = 6 * 60 * 60;
/** Apps Script caches its admin token for six hours; refresh five minutes early. */
const TOKEN_TTL_MS = (6 * 60 * 60 - 5 * 60) * 1000;

function signingSecret(): string {
  const secret = config.authSecret || config.adminPassword;
  if (!secret) {
    throw new Error("Set ADMIN_PASSWORD and AUTH_SECRET in .env.local before using the admin area.");
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
    return false;
  }
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function currentAdminToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.token;
  if (!config.adminPassword) {
    throw new SheetsError("ADMIN_PASSWORD is not set in .env.local.");
  }
  const token = await requestAdminToken(config.adminPassword);
  cachedToken = { token, expiresAt: now + TOKEN_TTL_MS };
  return token;
}

/**
 * Runs an admin call, refreshing the Apps Script token once if the sheet reports
 * an expired session. CacheService evicts entries without warning, so a token
 * that worked earlier can stop working between page loads.
 */
export async function withAdminToken<T>(run: (token: string) => Promise<T>): Promise<T> {
  try {
    return await run(await currentAdminToken());
  } catch (error) {
    const expired = error instanceof SheetsError && /session expired/i.test(error.message);
    if (!expired) throw error;
    cachedToken = null;
    return run(await currentAdminToken());
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
    throw new SheetsError("Your admin session has ended. Sign in again.");
  }
}

/** Timing-safe comparison so the password cannot be probed by response timing. */
export function passwordMatches(candidate: string): boolean {
  if (!config.adminPassword) return false;
  return matches(sha256Hex(candidate), sha256Hex(config.adminPassword));
}

function sha256Hex(value: string): string {
  return createHmac("sha256", "samson-cafe-compare").update(value, "utf8").digest("hex");
}
