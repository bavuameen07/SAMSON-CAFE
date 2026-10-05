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

export const SHEETS_TAGS = {
  products: "products",
  orders: "orders",
} as const;

type Params = Record<string, string | number | boolean | undefined>;

function endpoint(): string {
  if (!isSheetsConfigured) {
    throw new SheetsError(
      "GOOGLE_SCRIPT_URL is not set. Add it to .env.local and restart the dev server.",
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
    message?: unknown;
    success?: unknown;
  };
  if (envelope.ok === false) {
    throw new SheetsError(
      typeof envelope.message === "string" && envelope.message
        ? envelope.message
        : "The Apps Script request failed.",
    );
  }
  if (envelope.ok === true && envelope.data !== undefined) {
    return envelope.data as T;
  }
  if (envelope.success === true) {
    throw new SheetsError(
      "The deployed web app is an older build of the script and does not match apps-script/Code.gs. Redeploy the Apps Script web app with the current Code.gs.",
    );
  }
  throw new SheetsError(
    "Google Apps Script returned an unexpected response shape. Redeploy the web app.",
  );
}

function live<T>(action: string, params?: Params): Promise<T> {
  return fetch(buildUrl(action, params), { cache: "no-store" }).then((response) => unwrap<T>(response));
}

function cached<T>(action: string, params: Params, revalidate: number, tags: string[]): Promise<T> {
  return fetch(buildUrl(action, params), { next: { revalidate, tags } }).then((response) =>
    unwrap<T>(response),
  );
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Public menu data. Cached briefly so the storefront does not hammer Apps Script. */
export async function getProducts(): Promise<Product[]> {
  const rows = await cached<unknown>("getProducts", {}, 60, [SHEETS_TAGS.products]);
  return toRows(rows)
    .map(normalizeProduct)
    .filter((product) => product.id !== "");
}

/** Stock is revalidated and decremented inside Apps Script under a script lock. */
export async function placeOrder(itemId: string, quantity: number): Promise<Order> {
  return normalizeOrder(await live<unknown>("placeOrder", { itemId, quantity }));
}

/**
 * Mirrors adminLogin_ in Code.gs, where proof = sha256(nonce + sha256(password)).
 * The password stays on the server, so the browser never performs this step.
 */
export async function requestAdminToken(password: string): Promise<string> {
  const challenge = await live<{ nonce?: unknown }>("adminChallenge", {});
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
