import "server-only";
import { cache } from "react";
import { config, displaySettings } from "./config";
import { withProductDetails } from "./normalize";
import { withPictures } from "./product-images";
import {
  ApiError,
  getAdminStats,
  getItems,
  getOrders,
  getProducts,
  type DeploymentReport,
} from "./sheets";
import type { AdminStats, DisplayProduct, DisplaySettings, Order } from "./types";

export type MenuData = {
  products: DisplayProduct[];
  settings: DisplaySettings;
  connected: boolean;
  error: string | null;
};

export type AdminData = {
  products: DisplayProduct[];
  orders: Order[];
  stats: AdminStats | null;
  settings: DisplaySettings;
  connected: boolean;
  error: string | null;
};

function notConfiguredMessage(): string | null {
  if (!config.googleScriptUrl) {
    return "The cafe backend is not configured. Set GOOGLE_SCRIPT_URL, or googleScriptUrl in lib/config.ts, to load the live menu.";
  }
  return null;
}

/** `cache` dedupes this across the layout and page of a single admin request. */
export const loadMenu = cache(async (): Promise<MenuData> => {
  const settings = displaySettings();
  try {
    const products = await getProducts();
    return { products: withPictures(products), settings, connected: true, error: null };
  } catch (error) {
    const reason = notConfiguredMessage();
    return {
      products: [],
      settings,
      connected: false,
      error:
        reason ??
        (error instanceof ApiError
          ? error.message
          : "We couldn't load the cafe data. Please try again."),
    };
  }
});

/**
 * Admin dashboard data, read fresh so a page load or a TRY AGAIN always reflects
 * the sheet as it stands. The dashboard is low-traffic and is where edits are
 * verified, so freshness matters more here than on the storefront.
 *
 * The figures come from the backend's `adminStats` rather than being counted in
 * the browser, so the overview and the sheet cannot disagree.
 */
export const loadAdminData = cache(async (): Promise<AdminData> => {
  const settings = displaySettings();
  try {
    const [rawProducts, orders, stats] = await Promise.all([
      getItems(),
      getOrders(),
      getAdminStats(),
    ]);
    const products = withPictures(rawProducts);
    return {
      products,
      orders: withProductDetails(orders, products),
      stats,
      settings,
      connected: true,
      error: null,
    };
  } catch (error) {
    const reason = notConfiguredMessage();
    return {
      products: [],
      orders: [],
      stats: null,
      settings,
      connected: false,
      error:
        reason ??
        (error instanceof ApiError ? error.message : "We couldn't reach the cafe backend. Please try again."),
    };
  }
});

export type { DeploymentReport };
