import "server-only";

import { existsSync } from "node:fs";
import path from "node:path";
import { config } from "./config";
import {
  GENERATED_IMAGE_SIZE,
  generatorUrl,
  MENU_IMAGE_SIZE,
  seedFor,
} from "./image-generator";
import { describeProduct } from "./product-image-prompts";
import type { DisplayProduct, Product, ProductPicture } from "./types";

/**
 * One place that turns a menu item into a picture.
 *
 * Resolution order, first hit wins:
 *
 *   1. `sheet`     an image URL already stored in the Items sheet wins, so the
 *                  cafe can always override the automatic picture by hand.
 *   2. `asset`     a generated photo in `public/menu` for this exact dish. This
 *                  is what the live menu uses: a real, pre-optimised JPEG served
 *                  from the app itself, so it cannot break. Run
 *                  `npm run images` to produce or refresh these.
 *   3. `generated` a URL from the generator configured in `lib/config.ts`,
 *                  seeded from the dish signature. A product added to the Google
 *                  Sheet with no picture resolves here on its own, with no code
 *                  change. The seed is fixed by the name, so the same product
 *                  always yields the same URL: the picture never changes between
 *                  renders, requests or deploys.
 *   4. `fallback`  the cafe fallback photo, so a broken image icon can never
 *                  reach the page.
 *
 * Every step is a pure function of the product name, so nothing is generated
 * during a render and nothing is regenerated on the next page load.
 */

/** Where generated menu photos live, relative to the app root. */
const PUBLIC_DIR = "public";

/** Last-resort URL, used only if the committed fallback photo is missing. */
const REMOTE_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=900&q=80";

/**
 * Public files do not change while the server runs, so one `existsSync` per
 * path is enough. Checking up front also means a missing asset falls through to
 * the generator instead of rendering a URL the browser can only discover is a
 * 404.
 */
const assetPresence = new Map<string, boolean>();

function publicAssetExists(urlPath: string): boolean {
  const key = urlPath.replace(/^\/+/, "");
  const cached = assetPresence.get(key);
  if (cached !== undefined) return cached;
  const present = existsSync(path.join(process.cwd(), PUBLIC_DIR, key));
  assetPresence.set(key, present);
  return present;
}

/** `cappuccino` -> `/menu/cappuccino.jpg` */
export function menuAssetUrl(signature: string): string {
  return `/menu/${signature}.jpg`;
}

function isRemoteImage(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value);
}

function generatorOptions() {
  return {
    endpoint: config.imageGenerator.endpoint,
    model: config.imageGenerator.model,
    width: GENERATED_IMAGE_SIZE.width,
    height: GENERATED_IMAGE_SIZE.height,
  };
}

/** Re-exported so callers do not have to know which module owns the seed. */
export { seedFor };

function fallbackPicture(alt: string): ProductPicture {
  const fallback = config.fallbackImage;
  if (fallback.startsWith("/") && publicAssetExists(fallback)) {
    return { url: fallback, local: true, alt, origin: "fallback" };
  }
  return { url: REMOTE_FALLBACK_IMAGE, local: false, alt, origin: "fallback" };
}

/** Resolves the picture for one product. Pure, and cheap enough for any render. */
export function resolveProductImage(name: string, sheetImage?: string): ProductPicture {
  const trimmedName = name.replace(/\s+/g, " ").trim();
  const plan = trimmedName ? describeProduct(trimmedName) : null;
  const alt = plan?.alt ?? `${trimmedName} at Samson Cafe`;

  // 1. An explicit URL in the sheet always wins.
  const sheetUrl = (sheetImage ?? "").trim();
  if (isRemoteImage(sheetUrl)) {
    return { url: sheetUrl, local: false, alt, origin: "sheet" };
  }

  if (!plan) return fallbackPicture(alt);

  // 2. A generated photo for this exact dish, committed to the app.
  const asset = menuAssetUrl(plan.signature);
  if (publicAssetExists(asset)) {
    return {
      url: asset,
      width: MENU_IMAGE_SIZE.width,
      height: MENU_IMAGE_SIZE.height,
      local: true,
      alt,
      origin: "asset",
    };
  }

  // 3. Ask the generator. The URL is derived from the name, so it is stable.
  if (config.imageGenerator.enabled) {
    const options = generatorOptions();
    return {
      url: generatorUrl(plan, options),
      srcSet: [
        `${generatorUrl(plan, { ...options, width: 640, height: 640 })} 640w`,
        `${generatorUrl(plan, options)} ${options.width}w`,
      ].join(", "),
      width: options.width,
      height: options.height,
      local: false,
      alt,
      origin: "generated",
    };
  }

  // 4. Never show a broken image.
  return fallbackPicture(alt);
}

/** Adds the resolved picture to raw sheet rows, leaving the sheet row intact. */
export function withPictures(products: Product[]): DisplayProduct[] {
  return products.map((product) => ({
    ...product,
    picture: resolveProductImage(product.name, product.image),
  }));
}