import { toBoolean, toNumber, toText } from "./coerce";
import type { Order, OrderStatus, Product } from "./types";

type RawRow = Record<string, unknown> | unknown[];

function asRow(raw: unknown): RawRow {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  return {};
}

/** Reads the first present key, falling back to positional columns for sheet rows. */
function field(row: RawRow, keys: readonly (string | number)[]): unknown {
  for (const key of keys) {
    if (typeof key === "number") {
      if (!Array.isArray(row)) continue;
      const value = row[key];
      if (value !== undefined && value !== null) return value;
      continue;
    }
    if (Array.isArray(row)) continue;
    const value = row[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function orderStatus(value: unknown): OrderStatus {
  return toText(value).toLowerCase() === "paid" ? "Paid" : "Pending";
}

/** Items columns: id, name, image, stock, price. Enable state lives in script properties. */
export function normalizeProduct(raw: unknown): Product {
  const row = asRow(raw);
  return {
    id: toText(field(row, ["id", "ID", 0])),
    name: toText(field(row, ["name", "NAME", 1])),
    image: toText(field(row, ["image", "IMAGE", 2])),
    stock: toNumber(field(row, ["stock", "STOCK", 3])),
    price: toNumber(field(row, ["price", "PRICE", 4])),
    enabled: toBoolean(field(row, ["enabled"]), true),
  };
}

/** Orders columns: order id, item id, quantity, total, date, payment status. */
export function normalizeOrder(raw: unknown): Order {
  const row = asRow(raw);
  return {
    id: toText(field(row, ["id", "orderId", 0])),
    itemId: toText(field(row, ["itemId", "itemID", 1])),
    itemName: toText(field(row, ["itemName"])),
    image: toText(field(row, ["image"])),
    quantity: toNumber(field(row, ["quantity", 2])),
    total: toNumber(field(row, ["total", "totalAmount", 3])),
    date: toText(field(row, ["date", "dateTime", 4])),
    status: orderStatus(field(row, ["status", "paymentStatus", 5])),
  };
}

/** Orders carry no product name or image, so both are resolved from the Items sheet. */
export function withProductDetails(orders: Order[], products: Product[]): Order[] {
  return orders.map((order) => {
    const product = products.find((candidate) => candidate.id === order.itemId);
    if (!product) return order;
    return {
      ...order,
      itemName: order.itemName || product.name || order.itemId,
      image: order.image || product.image,
    };
  });
}
