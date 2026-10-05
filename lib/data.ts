import "server-only";
import { cache } from "react";
import { withAdminToken } from "./admin-session";
import { config, displaySettings } from "./config";
import { withProductDetails } from "./normalize";
import { getOrders, getProducts, SheetsError } from "./sheets";
import type { DisplaySettings, Order, Product } from "./types";

export type MenuData = {
  products: Product[];
  settings: DisplaySettings;
  connected: boolean;
  error: string | null;
};

export type AdminData = {
  products: Product[];
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
    return { products, settings, connected: true, error: null };
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

export const loadAdminData = cache(async (): Promise<AdminData> => {
  const settings = displaySettings();
  try {
    const [products, orders] = await Promise.all([getProducts(), withAdminToken(getOrders)]);
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
