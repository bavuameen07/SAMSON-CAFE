"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult, LoginState } from "@/lib/action";
import {
  adminKeyMatches,
  assertAdmin,
  clearAdminSession,
  createAdminSession,
} from "@/lib/admin-session";
import { resolveProductImage } from "@/lib/product-images";
import {
  addItem,
  ApiError,
  checkDeployment,
  deleteItem,
  describeDeployment,
  type DeploymentReport,
  getItems,
  getOrders,
  placeOrder,
  setStock,
  SHEETS_TAGS,
  updateItem,
  updatePayment,
} from "@/lib/sheets";
import { ORDER_STATUSES, type Order, type OrderStatus, type Product, type ProductDraft } from "@/lib/types";

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof ApiError) return { ok: false, error: error.message };
  return { ok: false, error: "Something went wrong. Please try again." };
}

function refreshStorefront(): void {
  updateTag(SHEETS_TAGS.products);
  revalidatePath("/");
  revalidatePath("/order");
}

function refreshAdminViews(): void {
  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/stock");
  revalidatePath("/admin/reports");
}

type DraftResult = { ok: true; draft: ProductDraft } | { ok: false; error: string };

function parseDraft(formData: FormData): DraftResult {
  const name = String(formData.get("name") ?? "").trim();
  const image = String(formData.get("image") ?? "").trim();
  const stock = Number(formData.get("stock"));
  const price = Number(formData.get("price"));

  if (!name) return { ok: false, error: "Product name is required." };
  if (!Number.isInteger(stock) || stock < 0) return { ok: false, error: "Stock must be zero or more." };
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, error: "Price must be greater than zero." };
  }
  return { ok: true, draft: { name, image, stock, price } };
}

export async function refreshMenuAction(): Promise<void> {
  refreshStorefront();
}

export async function refreshViewsAction(): Promise<void> {
  refreshStorefront();
  refreshAdminViews();
}

/**
 * Re-probes the configured backend and reports what it serves.
 *
 * Deliberately unauthenticated: it only reads the deployment's own version and
 * action list, which is not privileged information, and it returns no sheet data
 * and no key. That is what lets the error page's TRY AGAIN test the real
 * connection — the failure being retried usually lives outside this app.
 */
export async function diagnoseSheetsAction(): Promise<ActionResult<DeploymentReport>> {
  const report = await checkDeployment();
  if (report.reachable && report.missing.length === 0) return { ok: true, data: report };
  return {
    ok: false,
    error: describeDeployment(report) || "The cafe backend did not answer the connection check.",
  };
}

export async function placeOrderAction(
  itemId: string,
  quantity: number,
): Promise<ActionResult<Order>> {
  const cleanId = itemId.trim();
  const cleanQuantity = Number(quantity);

  if (!cleanId) return { ok: false, error: "Choose an item before placing your order." };
  if (!Number.isInteger(cleanQuantity) || cleanQuantity < 1) {
    return { ok: false, error: "Please select a valid quantity." };
  }

  try {
    const order = await placeOrder(cleanId, cleanQuantity);
    refreshStorefront();
    return { ok: true, data: order };
  } catch (error) {
    return failure(error);
  }
}

/**
 * Admin sign-in.
 *
 * The submitted value is checked against the configured admin key on the server,
 * then one authenticated call is made to confirm the backend accepts it before a
 * session cookie is issued. That ordering matters: a session handed out against a
 * key the backend would reject would produce a signed-in dashboard that fails on
 * every action.
 */
export async function adminLoginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const submitted = String(formData.get("adminKey") ?? "").trim();

  try {
    if (!adminKeyMatches(submitted)) {
      return { error: "Incorrect admin key." };
    }
  } catch (error) {
    // An unset ADMIN_KEY is a configuration fault, not a wrong sign-in, so it is
    // reported as such instead of "Incorrect admin key."
    return failure(error);
  }

  try {
    await getItems();
    await getOrders();
  } catch (error) {
    return failure(error);
  }

  await createAdminSession();
  redirect("/admin");
}

export async function adminLogoutAction(): Promise<void> {
  await clearAdminSession();
  redirect("/admin/login");
}

export async function createProductAction(formData: FormData): Promise<ActionResult<Product>> {
  try {
    await assertAdmin();
    const parsed = parseDraft(formData);
    if (!parsed.ok) return { ok: false, error: parsed.error };

    // Resolve the picture from the new product's name and store that URL on the
    // row, so the storefront serves the same picture without resolving it again.
    const draft: ProductDraft = parsed.draft.image
      ? parsed.draft
      : { ...parsed.draft, image: resolveProductImage(parsed.draft.name).url };

    const product = await addItem(draft);
    refreshStorefront();
    refreshAdminViews();
    return { ok: true, data: product };
  } catch (error) {
    return failure(error);
  }
}

export async function updateProductAction(formData: FormData): Promise<ActionResult<Product>> {
  try {
    await assertAdmin();
    const id = String(formData.get("id") ?? "").trim();
    if (!id) return { ok: false, error: "Product ID is required." };

    const parsed = parseDraft(formData);
    if (!parsed.ok) return { ok: false, error: parsed.error };

    const product = await updateItem(id, parsed.draft);
    refreshStorefront();
    refreshAdminViews();
    return { ok: true, data: product };
  } catch (error) {
    return failure(error);
  }
}

export async function updateStockAction(id: string, stock: number): Promise<ActionResult<Product>> {
  try {
    await assertAdmin();
    const productId = id.trim();
    if (!productId) return { ok: false, error: "Product ID is required." };

    const next = Number(stock);
    if (!Number.isInteger(next) || next < 0) {
      return { ok: false, error: "Stock must be zero or more." };
    }

    const product = await setStock(productId, next);
    refreshStorefront();
    refreshAdminViews();
    return { ok: true, data: product };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteProductAction(id: string): Promise<ActionResult<string>> {
  try {
    await assertAdmin();
    const productId = id.trim();
    if (!productId) return { ok: false, error: "Product ID is required." };

    await deleteItem(productId);
    refreshStorefront();
    refreshAdminViews();
    return { ok: true, data: productId };
  } catch (error) {
    return failure(error);
  }
}

export async function updatePaymentAction(
  orderId: string,
  itemId: string,
  status: OrderStatus,
): Promise<ActionResult<OrderStatus>> {
  try {
    await assertAdmin();
    const cleanOrderId = orderId.trim();
    const cleanItemId = itemId.trim();
    if (!cleanOrderId) return { ok: false, error: "Order ID is required." };
    if (!cleanItemId) return { ok: false, error: "Item ID is required." };
    if (!ORDER_STATUSES.includes(status)) {
      return { ok: false, error: "Payment status is invalid." };
    }

    await updatePayment(cleanOrderId, cleanItemId, status);
    updateTag(SHEETS_TAGS.orders);
    refreshAdminViews();
    return { ok: true, data: status };
  } catch (error) {
    return failure(error);
  }
}
