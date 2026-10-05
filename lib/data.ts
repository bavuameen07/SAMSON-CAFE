import "server-only";
import { cache } from "react";
import { withAdminToken } from "./admin-session";
import { config, displaySettings } from "./config";
import { withProductDetails } from "./normalize";
import { withPictures } from "./product-images";
import { getOrders, getProducts, SheetsError } from "./sheets";
import type { DisplayProduct, DisplaySettings, Order } from "./types";

export type MenuData = {
  products: DisplayProduct[];
  settings: DisplaySettings;
  connected: boolean;
  error: string | null;
};

export type AdminData = {
  products: DisplayProduct[];
  orders: Order[];
  settings: DisplaySettings;
  connected: boolean;
  error: string | null;
};

function notConfiguredMessage(): string | null {
  if (!config.googleScriptUrl) {
    return "Google Apps Script is not configured. Set googleScriptUrl in lib/config.ts to load the live menu.";
  }
  if (!config.adminPassword) {
    return "adminPassword is not set in lib/config.ts, so admin API calls cannot be authorised.";
  }
  return null;
}

/** `cache` dedupes this across the layout and page of a single admin request. */
export const loadMenu = cache(async (): Promise<MenuData> => {
  const settings = displaySettings();
  try {
    const products = (await getProducts()).filter((product) => product.enabled);
    return { products: withPictures(products), settings, connected: true, error: null };
  } catch (error) {
    const reason = notConfiguredMessage();
    return {
      products: [],
      settings,
      connected: false,
      error:
        reason ??
        (error instanceof SheetsError
          ? `We couldn't load the cafe data. ${error.message}`
          : "We couldn't load the cafe data. Check the Apps Script deployment and try again."),
    };
  }
});

/**
 * Admin dashboard data. Both reads are uncached, so a page load or a TRY AGAIN
 * always reflects the sheet as it stands. The dashboard is low-traffic and is
 * where edits are verified, so freshness matters more here than on the
 * storefront, where the shared 60s cache absorbs the traffic.
 */
export const loadAdminData = cache(async (): Promise<AdminData> => {
  const settings = displaySettings();
  try {
    const [rawProducts, orders] = await Promise.all([
      getProducts({ fresh: true }),
      withAdminToken(getOrders),
    ]);
    const products = withPictures(rawProducts);
    return {
      products,
      orders: withProductDetails(orders, products),
      settings,
      connected: true,
      error: null,
    };
  } catch (error) {
    const reason = notConfiguredMessage();
    return {
      products: [],
      orders: [],
      settings,
      connected: false,
      error:
        reason ??
        (error instanceof SheetsError
          ? error.message
          : "We couldn't reach Google Sheets. Check the Apps Script deployment and try again."),
    };
  }
});
