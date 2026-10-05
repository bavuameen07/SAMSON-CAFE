"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult, LoginState } from "@/lib/action";
import {
  assertAdmin,
  clearAdminSession,
  createAdminSession,
  passwordMatches,
  withAdminToken,
} from "@/lib/admin-session";
import { resolveProductImage } from "@/lib/product-images";
import {
  createProduct,
  placeOrder,
  SheetsError,
  SHEETS_TAGS,
  updatePayment,
  updateProduct,
  updateStock,
} from "@/lib/sheets";
import type { Order, OrderStatus, Product, ProductDraft } from "@/lib/types";

function failure(error: unknown): { ok: false; error: string } {
  if (error instanceof SheetsError) return { ok: false, error: error.message };
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

export async function placeOrderAction(
  itemId: string,
  quantity: number,
  requestId?: string,
): Promise<ActionResult<Order>> {
  const cleanId = itemId.trim();
  const cleanQuantity = Number(quantity);

  if (!cleanId) return { ok: false, error: "Choose an item before placing your order." };
  if (!Number.isInteger(cleanQuantity) || cleanQuantity < 1) {
    return { ok: false, error: "Please select a valid quantity." };
  }

  try {
    const order = await placeOrder(cleanId, cleanQuantity, requestId);
    refreshStorefront();
    return { ok: true, data: order };
  } catch (error) {
    return failure(error);
  }
}

export async function adminLoginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!passwordMatches(String(formData.get("password") ?? ""))) {
    return { error: "Incorrect admin password." };
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
    // row. The sheet then records which image the product uses, so the
    // storefront serves the same picture without resolving it again.
    const draft: ProductDraft = parsed.draft.image
      ? parsed.draft
      : { ...parsed.draft, image: resolveProductImage(parsed.draft.name).url };

    const product = await withAdminToken((token) => createProduct(token, draft));
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

    const product = await withAdminToken((token) => updateProduct(token, id, parsed.draft));
    refreshStorefront();
    refreshAdminViews();
    return { ok: true, data: product };
  } catch (error) {
    return failure(error);
  }
}

export async function setProductEnabledAction(
  id: string,
  enabled: boolean,
): Promise<ActionResult<Product>> {
  try {
    await assertAdmin();
    const productId = id.trim();
    if (!productId) return { ok: false, error: "Product ID is required." };

    const product = await withAdminToken((token) => updateProduct(token, productId, { enabled }));
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

    const product = await withAdminToken((token) => updateStock(token, productId, next));
    refreshStorefront();
    refreshAdminViews();
    return { ok: true, data: product };
  } catch (error) {
    return failure(error);
  }
}

export async function updatePaymentAction(
  orderId: string,
  status: OrderStatus,
): Promise<ActionResult<OrderStatus>> {
  try {
    await assertAdmin();
    const cleanOrderId = orderId.trim();
    if (!cleanOrderId) return { ok: false, error: "Order ID is required." };
    if (status !== "Paid" && status !== "Pending") {
      return { ok: false, error: "Payment status is invalid." };
    }

    await withAdminToken((token) => updatePayment(token, cleanOrderId, status));
    updateTag(SHEETS_TAGS.orders);
    refreshAdminViews();
    return { ok: true, data: status };
  } catch (error) {
    return failure(error);
  }
}
