import { toNumber, toText } from "./coerce";
import { ORDER_STATUSES, type DisplayProduct, type Order, type OrderStatus, type Product } from "./types";

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
  const text = toText(value);
  const match = ORDER_STATUSES.find((status) => status.toLowerCase() === text.toLowerCase());
  return match ?? "Pending";
}

/**
 * Item images are arbitrary URLs held in the sheet, and the sheet also carries
 * the literal placeholder "CellImage" where no picture was inserted. Anything
 * that is not an http(s) URL is treated as absent so the layout's own fallback
 * photo is used instead of a broken image.
 */
function toImage(value: unknown): string {
  const text = toText(value);
  return /^https?:\/\/\S+$/i.test(text) ? text : "";
}

/** Items columns: id, name, image, stock, price. */
export function normalizeProduct(raw: unknown): Product {
  const row = asRow(raw);
  return {
    id: toText(field(row, ["id", "itemId", 0])),
    name: toText(field(row, ["name", 1])),
    image: toImage(field(row, ["image", 2])),
    stock: toNumber(field(row, ["stock", 3])),
    price: toNumber(field(row, ["price", 4])),
  };
}

/**
 * Orders columns: order id, item id, quantity, total amount, date/time, payment
 * status. `placeOrder` also reports `itemName`, which `getOrders` omits; that is
 * resolved from the items sheet by `withProductDetails`.
 */
export function normalizeOrder(raw: unknown): Order {
  const row = asRow(raw);
  return {
    id: toText(field(row, ["orderId", "id", 0])),
    itemId: toText(field(row, ["itemId", 1])),
    itemName: toText(field(row, ["itemName"])),
    image: toText(field(row, ["image"])),
    quantity: toNumber(field(row, ["quantity", 2])),
    total: toNumber(field(row, ["totalAmount", "total", 3])),
    date: toText(field(row, ["dateTime", "date", 4])),
    status: orderStatus(field(row, ["paymentStatus", "status", 5])),
  };
}

/**
 * Orders carry no product name or image, so both are resolved from the Items
 * sheet, falling back to the picture resolved from the product name.
 */
export function withProductDetails(orders: Order[], products: DisplayProduct[]): Order[] {
  return orders.map((order) => {
    const product = products.find((candidate) => candidate.id === order.itemId);
    if (!product) return order;
    return {
      ...order,
      itemName: order.itemName || product.name || order.itemId,
      image: order.image || product.picture.url,
    };
  });
}
