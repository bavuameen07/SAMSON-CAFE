import "server-only";
import { createHash } from "node:crypto";
import { config, isSheetsConfigured } from "./config";
import { normalizeOrder, normalizeProduct } from "./normalize";
import type { Order, OrderStatus, Product, ProductDraft } from "./types";

export class SheetsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SheetsError";
  }
}

/**
 * The deployment answered, but it does not implement the action we asked for.
 * A pre-admin build of Code.gs replies with a `{ success, actions }` banner for
 * any unrecognised action, so this is the signal to try an older action name
 * rather than a genuine failure.
 */
export class UnknownActionError extends SheetsError {
  readonly actions: string[];

  constructor(actions: string[] = [], detail?: string) {
    super(
      detail ??
        (actions.length > 0
          ? `The deployed web app does not implement this action. It supports: ${actions.join(", ")}.`
          : "The deployed web app does not implement this action."),
    );
    this.name = "UnknownActionError";
    this.actions = actions;
  }
}

export const SHEETS_TAGS = {
  products: "products",
  orders: "orders",
} as const;

type Params = Record<string, string | number | boolean | undefined>;

function endpoint(): string {
  if (!isSheetsConfigured) {
    throw new SheetsError(
      "No Google Apps Script URL is configured. Set googleScriptUrl in lib/config.ts.",
    );
  }
  return config.googleScriptUrl;
}

function buildUrl(action: string, params: Params = {}): string {
  const base = endpoint();
  const query = new URLSearchParams({ action });
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    query.set(key, String(value));
  }
  return `${base}${base.includes("?") ? "&" : "?"}${query.toString()}`;
}

function toRows(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["items", "orders", "data"]) {
      if (Array.isArray(record[key])) return record[key] as unknown[];
    }
  }
  return [];
}

/**
 * Apps Script always answers 200 and signals failure in the body, so the `ok`
 * flag is the only reliable error signal.
 *
 * Two envelope generations exist in the wild. The current Code.gs answers
 * `{ ok, data }`. Deployments from before the admin dashboard answer
 * `{ success, items }` / `{ success, orders }`, and reply with a
 * `{ success, message, actions }` banner for any action they do not know.
 * Both are accepted so the storefront survives a redeploy gap.
 */
async function unwrap<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new SheetsError(
      `Google Apps Script responded with HTTP ${response.status}. Redeploy the web app if this persists.`,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new SheetsError("Google Apps Script returned a response that could not be parsed as JSON.");
  }

  if (!payload || typeof payload !== "object") {
    throw new SheetsError("Google Apps Script returned an unexpected response.");
  }

  const envelope = payload as {
    ok?: unknown;
    data?: unknown;
    items?: unknown;
    orders?: unknown;
    message?: unknown;
    success?: unknown;
    actions?: unknown;
  };

  if (envelope.ok === false) {
    const message =
      typeof envelope.message === "string" && envelope.message
        ? envelope.message
        : "The Apps Script request failed.";
    // A current build that lacks the action answers with ok:false. Treat that
    // the same as the legacy banner so callers can fall back or report it.
    if (/unknown api action/i.test(message)) {
      throw new UnknownActionError([], message);
    }
    throw new SheetsError(message);
  }
  if (envelope.ok === true && envelope.data !== undefined) {
    return envelope.data as T;
  }

  // Legacy envelope. A bare `{ success: true, actions: [...] }` carries no
  // rows, which means the action itself is unrecognised by this deployment.
  if (envelope.success === true) {
    if (Array.isArray(envelope.items)) return envelope.items as T;
    if (Array.isArray(envelope.orders)) return envelope.orders as T;
    if (envelope.data !== undefined) return envelope.data as T;
    throw new UnknownActionError(
      Array.isArray(envelope.actions)
        ? envelope.actions.filter((entry): entry is string => typeof entry === "string")
        : [],
    );
  }

  if (envelope.success === false) {
    throw new SheetsError(
      typeof envelope.message === "string" && envelope.message
        ? envelope.message
        : "The Apps Script request failed.",
    );
  }

  throw new SheetsError(
    "Google Apps Script returned an unexpected response shape. Redeploy the web app.",
  );
}

/**
 * A broken deployment can hold the request open until Apps Script gives up,
 * which surfaces as a bare HTTP 404 after ~35s. Cap the wait so checkout
 * reports a real reason quickly instead of appearing to hang.
 */
const LIVE_TIMEOUT_MS = 15_000;
const CACHED_TIMEOUT_MS = 30_000;

async function send(url: string, init: RequestInit, action: string, timeoutMs: number) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new SheetsError(
        `Google Apps Script did not answer "${action}" within ${timeoutMs / 1000}s. The deployed web app is not completing this request. Redeploy apps-script/Code.gs.`,
      );
    }
    throw new SheetsError(
      `Could not reach Google Apps Script for "${action}". Check the deployed web app URL and your connection.`,
    );
  }
}

function live<T>(action: string, params?: Params): Promise<T> {
  return send(buildUrl(action, params), { cache: "no-store" }, action, LIVE_TIMEOUT_MS).then(
    (response) => unwrap<T>(response),
  );
}

function cached<T>(action: string, params: Params, revalidate: number, tags: string[]): Promise<T> {
  return send(buildUrl(action, params), { next: { revalidate, tags } }, action, CACHED_TIMEOUT_MS).then(
    (response) => unwrap<T>(response),
  );
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Product action names, newest first. `getProducts` is the current Code.gs
 * action; `getPublicItems` and `getItems` are the pre-admin-dashboard names
 * still served by older deployments.
 */
const PRODUCT_ACTIONS = ["getProducts", "getPublicItems", "getItems"] as const;

function toProducts(rows: unknown): Product[] {
  return toRows(rows)
    .map(normalizeProduct)
    .filter((product) => product.id !== "");
}

/**
 * Public menu data. Cached briefly so the storefront does not hammer Apps
 * Script. Falls back to the legacy action names when the deployment predates
 * `getProducts`, so the storefront keeps working before a redeploy.
 */
export async function getProducts(): Promise<Product[]> {
  for (const action of PRODUCT_ACTIONS) {
    try {
      return toProducts(await cached<unknown>(action, {}, 60, [SHEETS_TAGS.products]));
    } catch (error) {
      if (!(error instanceof UnknownActionError)) throw error;
    }
  }
  throw new SheetsError(
    `The deployed web app exposes none of the product actions (${PRODUCT_ACTIONS.join(", ")}). Redeploy apps-script/Code.gs as a new web app version.`,
  );
}

export type DeploymentInfo = {
  build: string;
  actions: string[];
};

/**
 * Asks the deployment which build it is serving. The current Code.gs answers
 * this; a deployment from before this action existed cannot, which is itself a
 * reliable signal that it needs replacing.
 */
export async function getDeploymentInfo(): Promise<DeploymentInfo> {
  const info = await live<{ build?: unknown; actions?: unknown }>("version");
  return {
    build: typeof info.build === "string" ? info.build : "unknown",
    actions: Array.isArray(info.actions)
      ? info.actions.filter((entry): entry is string => typeof entry === "string")
      : [],
  };
}

/** Turns a rejected action into a message naming the build that refused it. */
async function staleDeploymentMessage(action: string, cause: UnknownActionError): Promise<string> {
  let detail = cause.message;
  try {
    const info = await getDeploymentInfo();
    detail = info.actions.includes(action)
      ? `The deployment reports build "${info.build}" and lists "${action}", but the call returned no order. Redeploy apps-script/Code.gs, then confirm the /exec URL in lib/config.ts points at that deployment.`
      : `The deployment reports build "${info.build}" and does not support "${action}". Redeploy apps-script/Code.gs as a new version, then put the new /exec URL in lib/config.ts.`;
  } catch {
    // The version probe failed too, so this deployment predates the action and
    // the original message is the best available detail.
  }
  return `This order could not be placed. ${detail}`;
}

/**
 * Stock is revalidated and decremented inside Apps Script under a script lock.
 *
 * Unlike reads, there is no legacy fallback: an older deployment answers an
 * unusable placeOrder with its generic banner instead of an order, so this
 * reports the mismatch precisely rather than letting the customer retry.
 */
export async function placeOrder(itemId: string, quantity: number): Promise<Order> {
  try {
    return normalizeOrder(await live<unknown>("placeOrder", { itemId, quantity }));
  } catch (error) {
    if (error instanceof UnknownActionError) {
      throw new SheetsError(await staleDeploymentMessage("placeOrder", error));
    }
    throw error;
  }
}

/**
 * Mirrors adminLogin_ in Code.gs, where proof = sha256(nonce + sha256(password)).
 * The password stays on the server, so the browser never performs this step.
 *
 * Admin actions only exist in the current Code.gs, so this has no legacy
 * fallback and reports the redeploy requirement directly.
 */
export async function requestAdminToken(password: string): Promise<string> {
  let challenge: { nonce?: unknown };
  try {
    challenge = await live<{ nonce?: unknown }>("adminChallenge", {});
  } catch (error) {
    if (error instanceof UnknownActionError) {
      throw new SheetsError(
        "This Apps Script deployment has no admin sign-in (it predates apps-script/Code.gs). Redeploy the web app to enable the admin dashboard.",
      );
    }
    throw error;
  }

  const nonce = typeof challenge.nonce === "string" ? challenge.nonce : "";
  if (!nonce) throw new SheetsError("Apps Script did not issue a login nonce.");

  const proof = sha256Hex(nonce + sha256Hex(password));
  const result = await live<{ token?: unknown }>("adminLogin", { nonce, proof });
  const token = typeof result.token === "string" ? result.token : "";
  if (!token) throw new SheetsError("Apps Script did not issue an admin token.");
  return token;
}

export async function getOrders(adminToken: string): Promise<Order[]> {
  return toRows(await live<unknown>("getOrders", { adminToken })).map(normalizeOrder);
}

export async function createProduct(adminToken: string, draft: ProductDraft): Promise<Product> {
  return normalizeProduct(await live<unknown>("createProduct", { adminToken, ...draft }));
}

export async function updateProduct(
  adminToken: string,
  id: string,
  patch: Partial<ProductDraft> & { enabled?: boolean },
): Promise<Product> {
  return normalizeProduct(await live<unknown>("updateProduct", { adminToken, id, ...patch }));
}

export async function updateStock(adminToken: string, id: string, stock: number): Promise<Product> {
  return normalizeProduct(await live<unknown>("updateStock", { adminToken, id, stock }));
}

/** updatePayment_ reads `status`, not `paymentStatus`, and takes the order id. */
export async function updatePayment(
  adminToken: string,
  orderId: string,
  status: OrderStatus,
): Promise<void> {
  await live<unknown>("updatePayment", { adminToken, orderId, status });
}
