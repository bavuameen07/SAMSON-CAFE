import "server-only";
import { config, isSheetsConfigured } from "./config";
import { normalizeOrder, normalizeProduct } from "./normalize";
import type { AdminStats, Order, OrderStatus, Product, ProductDraft } from "./types";

/**
 * The one place this app talks to Google Apps Script.
 *
 * Everything — customer menu, checkout and every admin page — goes through the
 * two helpers at the bottom of this file, `read` and `write`. No page or
 * component builds a request itself, so there is exactly one endpoint, one
 * envelope shape and one error message to reason about.
 *
 * The deployed web app answers `{ success: true, <key>: … }` on success and
 * `{ success: false, message: "…" }` on failure, always with HTTP 200. The
 * `success` flag is therefore the only reliable error signal, and it is handled
 * once, here.
 */

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

/** The action names this deployment serves. Used by the deployment check. */
export const API_ACTIONS = {
  customer: ["getPublicItems", "placeOrder"],
  admin: [
    "getItems",
    "getOrders",
    "adminStats",
    "updatePayment",
    "addItem",
    "updateItem",
    "deleteItem",
    "setStock",
  ],
  version: ["version"],
} as const;

/** Everything the admin dashboard needs in one place. */
export const ADMIN_ACTIONS = [
  ...API_ACTIONS.version,
  ...API_ACTIONS.admin,
] as const;

export const SHEETS_TAGS = {
  products: "products",
  orders: "orders",
} as const;

type Params = Record<string, string | number | boolean | undefined>;

function endpoint(): string {
  if (!isSheetsConfigured) {
    throw new ApiError(
      "The cafe backend is not configured. Set GOOGLE_SCRIPT_URL, or googleScriptUrl in lib/config.ts.",
    );
  }
  const base = config.googleScriptUrl;
  // A web app answers on /exec. /dev needs a Google login and returns an HTML
  // sign-in page instead of JSON, which otherwise surfaces as an unexplained
  // parse failure.
  if (!/\/exec(\?|$)/.test(base)) {
    throw new ApiError(
      `The configured backend URL does not end in /exec, so it cannot answer. Set GOOGLE_SCRIPT_URL (or googleScriptUrl in lib/config.ts) to the "Web app URL" from Deploy > New deployment.`,
    );
  }
  return base;
}

function buildUrl(action: string, params: Params = {}): string {
  const base = endpoint();
  const query = new URLSearchParams({ action });
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    query.set(key, String(value));
  }
  return `${base}?${query.toString()}`;
}

/**
 * Customer-facing copy.
 *
 * The API's own message is kept in `detail` and logged in development, but it is
 * raw backend text, so it is never what a customer or a cafe owner is shown.
 */
function friendly(message: string, fallback: string): string {
  return process.env.NODE_ENV === "development" ? `${fallback} (${message})` : fallback;
}

/** Names the transport problem precisely instead of reporting a generic failure. */
function httpFailure(action: string, status: number): ApiError {
  if (status === 401 || status === 403) {
    return new ApiError(
      friendly(
        `HTTP ${status}`,
        "The cafe backend refused this request. In Apps Script, open Deploy > Manage deployments and set “Who has access” to Anyone, then reload.",
      ),
    );
  }
  if (status === 404) {
    return new ApiError(
      friendly(
        `HTTP 404 on ${action}`,
        "The cafe backend could not be found at the configured address. The Apps Script may have been redeployed to a new URL — update GOOGLE_SCRIPT_URL.",
      ),
    );
  }
  if (status === 429) {
    return new ApiError(
      friendly(`HTTP 429 on ${action}`, "The cafe backend is busy. Please try again in a moment."),
    );
  }
  if (status >= 500) {
    return new ApiError(
      friendly(
        `HTTP ${status} on ${action}`,
        "The cafe backend had a problem handling this request. Please try again.",
      ),
    );
  }
  return new ApiError(
    friendly(
      `HTTP ${status} on ${action}`,
      "The cafe backend could not complete this request. Please try again.",
    ),
  );
}

const READ_TIMEOUT_MS = 20_000;
/** Generous, because a write touches the spreadsheet and Apps Script is slow. */
const WRITE_TIMEOUT_MS = 40_000;

/**
 * Runs one request and returns the parsed payload of a successful call.
 *
 * Both helpers below funnel through here so timeouts, non-JSON answers, HTTP
 * statuses and the `success: false` body are handled in exactly one place.
 */
async function request(
  url: string,
  action: string,
  init: RequestInit,
  timeoutMs: number,
  failureMessage: string,
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    if (timedOut) {
      // No confirmation arrived, which is not the same as "nothing happened".
      // A write may still have landed, so retrying is only safe where the caller
      // says so.
      throw new ApiError(
        timedOut
          ? friendly(
              `timeout after ${timeoutMs / 1000}s on ${action}`,
              `The cafe backend did not respond in time. ${
                action === "placeOrder"
                  ? "Your order may still have been saved — please check with the cafe before ordering again."
                  : "Please try again."
              }`,
            )
          : failureMessage,
      );
    }
    throw new ApiError(
      friendly(
        error instanceof Error ? error.message : String(error),
        "Could not reach the cafe backend. Check your connection and try again.",
      ),
    );
  }

  if (!response.ok) throw httpFailure(action, response.status);

  const text = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new ApiError(
      friendly(
        `non-JSON response for ${action}`,
        "The cafe backend returned something unexpected. If this is an Apps Script web app, set “Who has access” to Anyone in Deploy > Manage deployments.",
      ),
    );
  }

  if (!payload || typeof payload !== "object") {
    throw new ApiError(friendly(`unexpected payload for ${action}`, failureMessage));
  }

  const envelope = payload as Record<string, unknown>;
  if (envelope.success !== true) {
    const detail = typeof envelope.message === "string" ? envelope.message : `no message for ${action}`;
    // The backend's wording is written for the cafe owner and is safe to show in
    // the admin area; on the storefront a specific backend message can leak
    // internals, so the friendly copy stands in.
    if (action.startsWith("placeOrder") || action.startsWith("getPublicItems")) {
      throw new ApiError(friendly(detail, failureMessage));
    }
    throw new ApiError(detail);
  }

  return envelope;
}

/** GET. `params` carries the action and, for admin reads, the admin key. */
export async function read<T = unknown>(
  action: string,
  params: Params = {},
  failureMessage = "Unable to load. Please try again.",
): Promise<T> {
  const envelope = await request(
    buildUrl(action, params),
    action,
    { cache: "no-store" },
    READ_TIMEOUT_MS,
    failureMessage,
  );
  return envelope as T;
}

/**
 * POST.
 *
 * Apps Script only parses a POST body sent as `text/plain`, which is why this
 * uses that content type and a JSON string rather than a JSON content type.
 *
 * The action travels in the body, not the query string: this deployment reads
 * POST parameters from the parsed body, and a POST with the action only in the
 * URL is answered with "Unknown POST action". It is repeated in the query string
 * as well so the call is legible in the Apps Script execution log.
 */
export async function write<T = unknown>(
  action: string,
  body: Params = {},
  failureMessage = "That change could not be saved. Please try again.",
): Promise<T> {
  const envelope = await request(
    buildUrl(action),
    action,
    {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...body }),
      cache: "no-store",
    },
    WRITE_TIMEOUT_MS,
    failureMessage,
  );
  return envelope as T;
}

/* ------------------------------------------------------------------ customer */

function toProducts(envelope: Record<string, unknown>): Product[] {
  const rows = Array.isArray(envelope.items) ? envelope.items : [];
  return rows.map(normalizeProduct).filter((product) => product.id !== "");
}

/**
 * The public menu, from `getPublicItems`.
 *
 * Nothing in this deployment can be unpublished — `getPublicItems` returns every
 * item — so availability is decided by stock: an item with no stock left shows as
 * sold out and cannot be ordered.
 */
export async function getProducts(): Promise<Product[]> {
  return toProducts(await read("getPublicItems", {}, "Unable to load menu. Please try again."));
}

/**
 * Places a customer order through `placeOrder`.
 *
 * Only `itemId` and `quantity` are sent. Price and payment status are derived
 * server-side from the sheet, so they cannot be forged from the browser, and the
 * order id shown to the customer is always the one the backend returned.
 */
export async function placeOrder(itemId: string, quantity: number): Promise<Order> {
  const envelope = await write<Record<string, unknown>>(
    "placeOrder",
    { itemId, quantity },
    "Unable to place your order. Please try again.",
  );
  const order = envelope.order;
  if (!order || typeof order !== "object") {
    throw new ApiError(
      friendly(
        "placeOrder returned no order",
        "Your order was sent but the cafe could not confirm it. Please check with the cafe before ordering again.",
      ),
    );
  }
  return normalizeOrder(order);
}

/* --------------------------------------------------------------------- admin */

function requireKey(): string {
  if (!config.adminKey) {
    throw new ApiError(
      "No admin key is configured, so admin requests cannot be authorised. Set ADMIN_KEY, or adminKey in lib/config.ts.",
    );
  }
  return config.adminKey;
}

/** Every item, including any the storefront would not show, via `getItems`. */
export async function getItems(): Promise<Product[]> {
  const envelope = await read<Record<string, unknown>>(
    "getItems",
    { adminKey: requireKey() },
    "Unable to load products.",
  );
  return toProducts(envelope);
}

/** Every order, newest first, via `getOrders`. The sheet already returns it so. */
export async function getOrders(): Promise<Order[]> {
  const envelope = await read<Record<string, unknown>>(
    "getOrders",
    { adminKey: requireKey() },
    "Unable to load orders.",
  );
  const rows = Array.isArray(envelope.orders) ? envelope.orders : [];
  return rows.map(normalizeOrder);
}

/** The dashboard figures, via `adminStats`. Never computed locally. */
export async function getAdminStats(): Promise<AdminStats> {
  const envelope = await read<Record<string, unknown>>(
    "adminStats",
    { adminKey: requireKey() },
    "Unable to load dashboard statistics.",
  );
  const raw = (envelope.stats ?? {}) as Record<string, unknown>;
  const n = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);
  return {
    totalItems: n(raw.totalItems),
    totalStock: n(raw.totalStock),
    lowStockItems: n(raw.lowStockItems),
    outOfStockItems: n(raw.outOfStockItems),
    totalOrders: n(raw.totalOrders),
    pendingOrders: n(raw.pendingOrders),
    paidOrders: n(raw.paidOrders),
    cancelledOrders: n(raw.cancelledOrders),
    failedOrders: n(raw.failedOrders),
    totalSales: n(raw.totalSales),
  };
}

export async function addItem(draft: ProductDraft): Promise<Product> {
  const envelope = await write<Record<string, unknown>>(
    "addItem",
    { adminKey: requireKey(), ...draft },
    "Unable to add this product.",
  );
  return normalizeProduct(envelope.item ?? envelope);
}

export async function updateItem(id: string, draft: ProductDraft): Promise<Product> {
  const envelope = await write<Record<string, unknown>>(
    "updateItem",
    { adminKey: requireKey(), itemId: id, ...draft },
    "Unable to update this product.",
  );
  return normalizeProduct(envelope.item ?? envelope);
}

export async function setStock(id: string, stock: number): Promise<Product> {
  const envelope = await write<Record<string, unknown>>(
    "setStock",
    { adminKey: requireKey(), itemId: id, stock },
    "Unable to update stock.",
  );
  return normalizeProduct(envelope.item ?? envelope);
}

export async function deleteItem(id: string): Promise<void> {
  await write("deleteItem", { adminKey: requireKey(), itemId: id }, "Unable to delete this product.");
}

/**
 * Changes a payment status. `itemId` is required alongside the order id, so the
 * status is always sent with the order's own item.
 */
export async function updatePayment(
  orderId: string,
  itemId: string,
  status: OrderStatus,
): Promise<void> {
  await write(
    "updatePayment",
    { adminKey: requireKey(), orderId, itemId, paymentStatus: status },
    "Unable to update payment status.",
  );
}

/* ------------------------------------------------------- deployment checking */

export type DeploymentInfo = {
  build: string;
  actions: string[];
};

/**
 * Asks the backend which build it is serving, via `version`.
 *
 * The deployed `version` action answers
 * `{ success: true, message, version, actions: { customer: [...], admin: [...] } }`.
 */
export async function getDeploymentInfo(): Promise<DeploymentInfo> {
  const envelope = await read<{ version?: unknown; actions?: unknown }>("version");
  const actions = envelope.actions;
  const listed =
    actions && typeof actions === "object" && !Array.isArray(actions)
      ? Object.values(actions as Record<string, unknown>)
          .filter(Array.isArray)
          .flat()
          .filter((a): a is string => typeof a === "string")
      : Array.isArray(actions)
        ? actions.filter((a): a is string => typeof a === "string")
        : [];
  return {
    build: typeof envelope.version === "string" ? envelope.version : "unknown",
    actions: listed,
  };
}

export type DeploymentReport = {
  reachable: boolean;
  build: string;
  actions: string[];
  missing: string[];
  detail: string | null;
};

/** Reports what the configured backend actually serves, without throwing. */
export async function checkDeployment(): Promise<DeploymentReport> {
  try {
    const info = await getDeploymentInfo();
    return {
      reachable: true,
      build: info.build,
      actions: info.actions,
      missing: ADMIN_ACTIONS.filter((action) => !info.actions.includes(action)),
      detail: null,
    };
  } catch (error) {
    return {
      reachable: false,
      build: "",
      actions: [],
      missing: [...ADMIN_ACTIONS],
      detail: error instanceof ApiError ? error.message : "The cafe backend could not be reached.",
    };
  }
}

/** Plain-language summary of a deployment that cannot serve the admin API. */
export function describeDeployment(report: DeploymentReport): string {
  if (!report.reachable) {
    return `The configured cafe backend could not be reached. ${report.detail ?? ""}`.trim();
  }
  if (report.missing.length === 0) return "";
  const served = report.actions.length > 0 ? report.actions.join(", ") : "nothing";
  return `The configured cafe backend is serving version "${report.build}", which does not implement these admin actions: ${report.missing.join(", ")}. It serves only: ${served}. This is not a password problem. Redeploy the Apps Script web app, then set GOOGLE_SCRIPT_URL to the new /exec URL — see "Deploying the Apps Script" in README.md.`;
}
