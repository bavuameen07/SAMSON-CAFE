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

/**
 * A write was accepted but no record came back, so the outcome is genuinely
 * unknown: the order may or may not have been written. This must never be
 * reported as an unsupported action, which would tell the customer to retry into
 * a duplicate order.
 */
export class IndeterminateResultError extends SheetsError {
  readonly actions: string[];

  constructor(actions: string[] = []) {
    super(
      actions.length > 0
        ? `Apps Script accepted the request but returned no record, so the outcome is unknown. It supports: ${actions.join(", ")}.`
        : "Apps Script accepted the request but returned no record, so the outcome is unknown.",
    );
    this.name = "IndeterminateResultError";
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
async function unwrap<T>(
  response: Response,
  emptySuccess: "unknown-action" | "indeterminate" = "unknown-action",
): Promise<T> {
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
    order?: unknown;
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
  // rows and no created object. For a read that means the action is
  // unrecognised and the caller should try another name; for a write it means
  // the call may have landed without returning the record it created.
  if (envelope.success === true) {
    if (Array.isArray(envelope.items)) return envelope.items as T;
    if (Array.isArray(envelope.orders)) return envelope.orders as T;
    // placeOrder answers `{ success, message, order }` on this deployment.
    if (envelope.order !== undefined) return envelope.order as T;
    if (envelope.data !== undefined) return envelope.data as T;
    const advertised = Array.isArray(envelope.actions)
      ? envelope.actions.filter((entry): entry is string => typeof entry === "string")
      : [];
    if (emptySuccess === "indeterminate") throw new IndeterminateResultError(advertised);
    throw new UnknownActionError(advertised);
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

async function send(
  url: string,
  init: RequestInit,
  action: string,
  timeoutMs: number,
  timeoutHint?: string,
) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      // A timeout means no confirmation arrived, not that nothing happened. The
      // write may still land, so say so instead of telling the customer to
      // redeploy, which this error never implies.
      throw new SheetsError(
        `Google Apps Script did not answer "${action}" within ${timeoutMs / 1000}s, so the outcome is unknown. ${
          timeoutHint ?? "Check whether the change was saved before submitting again."
        }`,
      );
    }
    throw new SheetsError(
      `Could not reach Google Apps Script for "${action}". Check your connection and the web app URL, then try again.`,
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

/**
 * Writes go out as a POST carrying a JSON body.
 *
 * The deployed handler only creates orders from `doPost`. A GET placeOrder is
 * answered with the generic `{ success, message, actions }` banner rather than
 * an order, so the action and its arguments must travel in the JSON body as
 * `{ action, itemId, quantity }`. The action is repeated in the query string
 * so the call is self-describing in the Apps Script execution log.
 */
function postJson<T>(
  action: string,
  body: Params = {},
  timeoutHint?: string,
  emptySuccess: "unknown-action" | "indeterminate" = "unknown-action",
): Promise<T> {
  return send(
    buildUrl(action),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
      cache: "no-store",
    },
    action,
    LIVE_TIMEOUT_MS,
    timeoutHint,
  ).then((response) => unwrap<T>(response, emptySuccess));
}

/**
 * Admin calls travel as a POST JSON body rather than a query string.
 *
 * They carry the admin session token and the password-derived login proof, and a
 * URL reaches Apps Script execution logs, browser history and proxy logs, so
 * those arguments must not be in one. Code.gs accepts these actions on either
 * verb; the body is simply the only form that keeps the token out of a URL, and
 * it is never cached, so every admin read sees the sheet as it is right now —
 * which is what makes TRY AGAIN meaningful.
 */
function postAdmin<T>(action: string, body: Params = {}): Promise<T> {
  return send(
    buildUrl(action),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
      cache: "no-store",
    },
    action,
    LIVE_TIMEOUT_MS,
  ).then((response) => unwrap<T>(response));
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
 *
 * `fresh` skips the cache for the admin dashboard, which has to reflect an
 * edit the moment it is saved rather than up to a minute later.
 */
export async function getProducts({ fresh = false }: { fresh?: boolean } = {}): Promise<Product[]> {
  for (const action of PRODUCT_ACTIONS) {
    try {
      const rows = fresh
        ? await live<unknown>(action)
        : await cached<unknown>(action, {}, 60, [SHEETS_TAGS.products]);
      return toProducts(rows);
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

/** The actions the admin dashboard needs. A deployment missing any is stale. */
export const ADMIN_ACTIONS = [
  "version",
  "adminChallenge",
  "adminLogin",
  "getOrders",
  "createProduct",
  "updateProduct",
  "updateStock",
  "updatePayment",
] as const;

export type DeploymentReport = {
  /** Whether the web app answered at all, as opposed to answering wrongly. */
  reachable: boolean;
  build: string;
  /** Actions the deployment says it serves. Empty when it could not be asked. */
  actions: string[];
  /** Admin actions it does not serve, which is why the dashboard fails. */
  missing: string[];
  /** Set when the web app could not be reached at all. */
  detail: string | null;
};

/**
 * Reports what the configured web app is actually serving, without throwing.
 *
 * A pre-`version` deployment answers the probe with the same banner it sends for
 * every unknown action, and that banner carries the deployment's own action
 * list, so a stale build can still be described precisely. This is what turns
 * "something went wrong" into a diagnosis the operator can act on.
 */
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
    if (error instanceof UnknownActionError) {
      return {
        reachable: true,
        build: "unknown",
        actions: error.actions,
        missing: ADMIN_ACTIONS.filter((action) => !error.actions.includes(action)),
        detail: null,
      };
    }
    return {
      reachable: false,
      build: "",
      actions: [],
      missing: [...ADMIN_ACTIONS],
      detail:
        error instanceof SheetsError
          ? error.message
          : "The Apps Script web app could not be reached.",
    };
  }
}

/** Plain-language summary of a stale deployment, shared by every admin page. */
export function describeDeployment(report: DeploymentReport): string {
  if (!report.reachable) {
    return `The Apps Script web app in lib/config.ts could not be reached. ${report.detail ?? ""}`.trim();
  }
  if (report.missing.length === 0) return "";
  const served = report.actions.length > 0 ? report.actions.join(", ") : "nothing";
  return `The Apps Script web app in lib/config.ts is an older build, so it cannot serve the admin dashboard. It reports build "${report.build}" and serves: ${served}. It is missing: ${report.missing.join(", ")}. Redeploy apps-script/Code.gs as a new web app version to fix this — see the "Deploying the web app" section of README.md.`;
}

/**
 * Explains a missing admin action once, in one place, so every admin surface
 * tells the operator the same thing instead of guessing at the cause.
 */
async function adminUnavailable(error: unknown): Promise<SheetsError> {
  if (!(error instanceof UnknownActionError)) {
    return error instanceof SheetsError
      ? error
      : new SheetsError("The admin API request failed.");
  }
  const report = await checkDeployment();
  return new SheetsError(
    describeDeployment(report) ||
      `The Apps Script deployment does not implement this admin action. It serves: ${
        report.actions.join(", ") || "nothing"
      }.`,
  );
}

/**
 * Creates an order through the deployed `placeOrder` action.
 *
 * Verified against the live web app: it reads a POST JSON body of
 * `{ action, itemId, quantity }` and answers
 * `{ success: true, message: "Order placed successfully", order: {...} }`.
 * Price, total and payment status are derived server-side from the Items sheet,
 * so they are deliberately not sent and cannot be forged by the browser. A GET
 * to the same action returns the generic banner and creates nothing.
 *
 * `requestId` is an idempotency key. Code.gs remembers it briefly, so a retry
 * after a timeout returns the order it already wrote rather than duplicating it.
 */
export async function placeOrder(
  itemId: string,
  quantity: number,
  requestId?: string,
): Promise<Order> {
  const key = requestId ? { requestId } : {};
  try {
    return normalizeOrder(
      await postJson<unknown>(
        "placeOrder",
        { itemId, quantity, ...key },
        "Retrying is safe: this request carries an idempotency key, so if the order was already written the script returns that same order instead of creating a second one.",
        "indeterminate",
      ),
    );
  } catch (error) {
    if (error instanceof IndeterminateResultError) {
      throw new SheetsError(
        "Google Apps Script accepted the order request but did not return the order it created, so this order is unconfirmed. Do not submit again yet: check the admin orders list first. If it is not there, placing the order again is safe because this request carries an idempotency key.",
      );
    }
    if (error instanceof UnknownActionError) {
      // The banner means this deployment advertised placeOrder but did not
      // create an order from it, so name the build rather than blame the cart.
      let detail = `It answered the POST with its generic banner instead of an order, so it does not create orders. It advertises: ${error.actions.join(", ") || "no actions"}.`;
      try {
        const info = await getDeploymentInfo();
        detail += ` It reports build "${info.build}".`;
      } catch {
        // No version action on this deployment; the banner detail stands.
      }
      throw new SheetsError(`This order could not be placed. ${detail}`);
    }
    throw error;
  }
}

/**
 * Mirrors adminLogin_ in Code.gs, where proof = sha256(nonce + sha256(password)).
 * The password stays on the server, so the browser never performs this step, and
 * the proof travels in a POST body so it is not left in a URL.
 *
 * The deployment is checked before any admin call is attempted. A stale build
 * cannot serve these actions at all, and it fails in different ways depending on
 * the verb: its GET handler answers with the list of actions it does have, while
 * its POST handler either rejects the action outright or hangs until it times
 * out. Asking first turns all three into one accurate answer, quickly, instead of
 * surfacing whichever symptom happened to arrive first.
 */
export async function requestAdminToken(password: string): Promise<string> {
  const report = await checkDeployment();
  const stale = describeDeployment(report);
  if (stale) throw new SheetsError(stale);

  let challenge: { nonce?: unknown };
  try {
    challenge = await postAdmin<{ nonce?: unknown }>("adminChallenge");
  } catch (error) {
    throw await adminUnavailable(error);
  }

  const nonce = typeof challenge.nonce === "string" ? challenge.nonce : "";
  if (!nonce) throw new SheetsError("Apps Script did not issue a login nonce.");

  const proof = sha256Hex(nonce + sha256Hex(password));
  const result = await postAdmin<{ token?: unknown }>("adminLogin", { nonce, proof });
  const token = typeof result.token === "string" ? result.token : "";
  if (!token) throw new SheetsError("Apps Script did not issue an admin token.");
  return token;
}

export async function getOrders(adminToken: string): Promise<Order[]> {
  return toRows(await postAdmin<unknown>("getOrders", { adminToken })).map(normalizeOrder);
}

export async function createProduct(adminToken: string, draft: ProductDraft): Promise<Product> {
  return normalizeProduct(await postAdmin<unknown>("createProduct", { adminToken, ...draft }));
}

export async function updateProduct(
  adminToken: string,
  id: string,
  patch: Partial<ProductDraft> & { enabled?: boolean },
): Promise<Product> {
  return normalizeProduct(await postAdmin<unknown>("updateProduct", { adminToken, id, ...patch }));
}

export async function updateStock(adminToken: string, id: string, stock: number): Promise<Product> {
  return normalizeProduct(await postAdmin<unknown>("updateStock", { adminToken, id, stock }));
}

/** updatePayment_ reads `status`, not `paymentStatus`, and takes the order id. */
export async function updatePayment(
  adminToken: string,
  orderId: string,
  status: OrderStatus,
): Promise<void> {
  await postAdmin<unknown>("updatePayment", { adminToken, orderId, status });
}
