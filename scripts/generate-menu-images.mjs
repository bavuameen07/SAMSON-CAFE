#!/usr/bin/env node
/**
 * Generates the Samson Cafe menu photos from their product names.
 *
 * It reuses the app's own prompt pipeline (`lib/product-image-prompts.ts` and
 * `lib/image-generator.ts`), so a picture generated here is byte-for-byte the
 * one the site resolves later for the same product name.
 *
 *   node scripts/generate-menu-images.mjs                 every product in the sheet
 *   node scripts/generate-menu-images.mjs "Vanilla Latte" just these names
 *   node scripts/generate-menu-images.mjs --fallback      only the cafe fallback
 *   node scripts/generate-menu-images.mjs --force         regenerate existing
 *
 * Output is a 4:3 progressive JPEG per dish in public/menu, named after the
 * dish signature the resolver looks for. Existing files are left alone unless
 * --force is passed, so this is safe to run at any time.
 *
 * The generator endpoint is anonymous and rate limited, so requests are spaced
 * and retried with backoff. A dish that cannot be fetched is reported and
 * skipped; the app then resolves that product through the same endpoint at
 * request time, or falls back to the cafe photo.
 */

import { mkdir, readFile, access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(import.meta.dirname, "..");
const MENU_DIR = path.join(ROOT, "public", "menu");
const JPEG_QUALITY = 78;

/** Spacing and retries for an anonymous, rate-limited generator. */
const REQUEST_GAP_MS = 16_000;
const MAX_ATTEMPTS = 6;

/** A cafe photo used when a product has no picture of its own. */
const FALLBACK_PROMPT =
  "Professional realistic cafe food photography of a warm, welcoming coffee shop " +
  "counter, a barista serving a ceramic cup of coffee beside an espresso machine " +
  "and a wooden pastry board, softly out of focus. " +
  "Professional realistic cafe food photography, soft warm natural window light, " +
  "shallow depth of field, 50mm lens, appetising, high detail, styled on a ceramic " +
  "plate or wooden board, no people, no text, no logo, no watermark.";

// The shared modules are .ts and this package has no "type" field, so Node warns
// while stripping their types. That warning is noise for a build tool, so the
// npm script runs this file with --disable-warning=MODULE_TYPELESS_PACKAGE_JSON.
const { describeProduct } = await import("../lib/product-image-prompts.ts");
const { generatorUrl, MENU_IMAGE_SIZE } = await import("../lib/image-generator.ts");
const { default: sharp } = await import("sharp");

/** Reads the generator settings out of lib/config.ts, the single source of truth. */
async function readConfig() {
  const text = await readFile(path.join(ROOT, "lib", "config.ts"), "utf8");
  const pick = (pattern, fallback) => text.match(pattern)?.[1] ?? fallback;
  return {
    scriptUrl: pick(/googleScriptUrl:\s*"([^"]+)"/, ""),
    endpoint: pick(/endpoint:\s*"([^"]+)"/, ""),
    model: pick(/model:\s*"([^"]+)"/, "flux"),
    token: pick(/token:\s*"([^"]*)"/, ""),
  };
}

async function parseArgs(argv) {
  const options = { names: [], force: false, fallback: false };
  for (const arg of argv) {
    if (arg === "--force") options.force = true;
    else if (arg === "--fallback") options.fallback = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else options.names.push(arg);
  }
  return options;
}

/** Product names straight from the deployed sheet, when it is reachable. */
async function sheetNames(scriptUrl) {
  if (!scriptUrl) return [];
  const actions = ["getPublicItems", "getItems"];
  for (const action of actions) {
    try {
      const response = await fetch(`${scriptUrl}?action=${action}`, {
        signal: AbortSignal.timeout(40_000),
      });
      if (!response.ok) continue;
      const payload = await response.json();
      if (payload?.ok === false) continue;
      const rows = payload?.data ?? payload?.items ?? [];
      const names = (Array.isArray(rows) ? rows : [])
        .map((row) => (Array.isArray(row) ? row[1] : row?.name))
        .filter((name) => typeof name === "string" && name.trim() !== "");
      if (names.length > 0) return names;
    } catch {
      // Try the next, older action name.
    }
  }
  return [];
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

/** Fetches bytes from the generator, spacing and retrying around its limits. */
async function fetchImage(url, token) {
  let lastError = "unknown error";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    await sleep(attempt === 1 ? 0 : REQUEST_GAP_MS * attempt);
    try {
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: AbortSignal.timeout(180_000),
      });
      if (response.ok) {
        const type = response.headers.get("content-type") ?? "";
        if (type.startsWith("image/")) return Buffer.from(await response.arrayBuffer());
        lastError = `expected an image, got ${type || "nothing"}`;
      } else if (response.status === 402 || response.status === 429) {
        lastError = `HTTP ${response.status} (generator rate limit or quota)`;
      } else {
        lastError = `HTTP ${response.status}`;
      }
    } catch (error) {
      lastError = error?.message ?? "network error";
    }
    process.stdout.write(`    retry ${attempt}/${MAX_ATTEMPTS}: ${lastError}\n`);
  }
  throw new Error(lastError);
}

/**
 * Crops to the layout's aspect ratio, downscales and compresses.
 *
 * `position: "attention"` keeps the busiest part of the frame, which is the
 * drink or the plate, rather than blindly slicing the middle.
 */
async function writeOptimised(buffer, file) {
  const pipeline = sharp(buffer, { failOn: "error" })
    .rotate()
    .resize(MENU_IMAGE_SIZE.width, MENU_IMAGE_SIZE.height, {
      fit: "cover",
      position: sharp.strategy.attention,
    })
    .jpeg({ quality: JPEG_QUALITY, progressive: true, mozjpeg: true });

  const info = await pipeline.toFile(file);
  return info;
}

/**
 * A blank or single-colour frame means the generator answered with something
 * useless. Real photography has a wide spread of tones.
 */
async function assertLooksPhotographic(file) {
  const stats = await sharp(file).stats();
  const spread = stats.channels.map((channel) => channel.stdev);
  const worst = Math.min(...spread);
  if (worst < 12) {
    throw new Error(`image looks blank (channel deviation ${worst.toFixed(1)})`);
  }
  return worst;
}

async function main() {
  const options = await parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(
      "Usage: node scripts/generate-menu-images.mjs [--force] [--fallback] [Product name ...]\n",
    );
    return;
  }

  const config = await readConfig();
  if (!config.endpoint) throw new Error("No imageGenerator.endpoint found in lib/config.ts");

  await mkdir(MENU_DIR, { recursive: true });

  if (options.fallback) {
    const file = path.join(MENU_DIR, "fallback.jpg");
    await generate(
      { name: "Samson Cafe fallback", signature: "fallback", prompt: FALLBACK_PROMPT },
      file,
      config,
    );
    return;
  }

  const names =
    options.names.length > 0 ? options.names : await sheetNames(config.scriptUrl);
  if (names.length === 0) {
    throw new Error(
      "No product names given and the deployed sheet could not be read. " +
        "Pass names explicitly, e.g. node scripts/generate-menu-images.mjs \"Cappuccino\".",
    );
  }

  const plans = names.map((name) => describeProduct(name)).filter(Boolean);
  process.stdout.write(`Generating ${plans.length} menu photo(s) into public/menu\n\n`);

  let generated = 0;
  let skipped = 0;
  const failed = [];

  for (const plan of plans) {
    const file = path.join(MENU_DIR, `${plan.signature}.jpg`);
    if (!options.force && (await exists(file))) {
      process.stdout.write(`  = ${plan.signature.padEnd(22)} ${plan.name} (kept)\n`);
      skipped += 1;
      continue;
    }
    try {
      await generate(plan, file, config);
      generated += 1;
    } catch (error) {
      process.stdout.write(`  ! ${plan.signature.padEnd(22)} ${plan.name} (${error.message})\n`);
      failed.push(plan.name);
    }
  }

  process.stdout.write(
    `\nDone. ${generated} generated, ${skipped} kept, ${failed.length} failed.\n`,
  );
  if (failed.length > 0) {
    process.stdout.write(`Failed: ${failed.join(", ")}\n`);
  }
}

async function generate(plan, file, config) {
  const url = generatorUrl(plan, {
    endpoint: config.endpoint,
    model: config.model,
    width: MENU_IMAGE_SIZE.width,
    height: MENU_IMAGE_SIZE.height,
  });
  const buffer = await fetchImage(url, config.token);
  const info = await writeOptimised(buffer, file);
  const deviation = await assertLooksPhotographic(file);
  process.stdout.write(
    `  + ${plan.signature.padEnd(22)} ${plan.name} ` +
      `(${info.width}x${info.height}, ${(info.size / 1024).toFixed(0)}kB)\n`,
  );
  return deviation;
}

await main();