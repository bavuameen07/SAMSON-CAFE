#!/usr/bin/env node
/**
 * Probes the configured Apps Script deployment and reports what it actually
 * serves, without ever printing the admin key or any sheet data.
 *
 *   npm run script:check
 *
 * The URL comes from GOOGLE_SCRIPT_URL, falling back to the single configured
 * endpoint in lib/config.ts, so there is never a second copy to keep in step.
 *
 * The admin key is read from ADMIN_KEY (or SAMSON_ADMIN_KEY). It is never
 * hardcoded here, never logged and never echoed: the signed-in app compares it
 * on the server, and this script only needs it to prove the protected actions
 * accept it.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

/** Reads the fallback endpoint out of lib/config.ts so there is one source. */
function configuredUrl() {
  if (process.env.GOOGLE_SCRIPT_URL) return process.env.GOOGLE_SCRIPT_URL.trim();
  const source = readFileSync(resolve(ROOT, "lib", "config.ts"), "utf8");
  const match = source.match(/"(https:\/\/script\.google\.com\/macros\/[^"]+)"/);
  return match ? match[1] : "";
}

const URL_FROM = process.env.GOOGLE_SCRIPT_URL ? "GOOGLE_SCRIPT_URL" : "lib/config.ts";
const ENDPOINT = configuredUrl();
const ADMIN_KEY = (process.env.ADMIN_KEY ?? process.env.SAMSON_ADMIN_KEY ?? "").trim();

const CUSTOMER_ACTIONS = ["getPublicItems", "placeOrder"];
const ADMIN_ACTIONS = [
  "getItems",
  "getOrders",
  "adminStats",
  "updatePayment",
  "addItem",
  "updateItem",
  "deleteItem",
  "setStock",
];

const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(
    `${name.padEnd(22)} ${ok ? "PASS" : "FAIL"}${detail ? `  ${detail}` : ""}`,
  );
}

/** Reported but not counted: an optional step, not a failure of the deployment. */
function skip(name, detail) {
  console.log(`${name.padEnd(22)} SKIP  ${detail}`);
}

function preview(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (!text) return "";
  return text.length > 90 ? `${text.slice(0, 87)}…` : text;
}

/**
 * One API call.
 *
 * `method: "POST"` sends the JSON body as `text/plain`, which is the only content
 * type Apps Script parses from a web app request. The action goes in the body for
 * the same reason — this deployment reads POST parameters from the parsed body.
 */
async function call(action, { method = "GET", body = null, adminKey = null } = {}) {
  const url = new URL(ENDPOINT);
  url.searchParams.set("action", action);
  if (adminKey !== null) url.searchParams.set("adminKey", adminKey);

  const init = { method, headers: {}, cache: "no-store" };
  if (method === "POST") {
    init.headers["Content-Type"] = "text/plain;charset=utf-8";
    init.body = JSON.stringify({ action, ...body });
  }

  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = null;
  }
  return { status: response.status, payload, text };
}

async function checkVersion() {
  if (!ENDPOINT) {
    record("endpoint", false, "No endpoint configured.");
    return null;
  }
  record("endpoint", true, `${URL_FROM} · ${/\/exec(\?|$)/.test(ENDPOINT) ? "/exec" : "NOT /exec"}`);

  let result;
  try {
    result = await call("version");
  } catch (error) {
    record("version", false, `unreachable (${error.message})`);
    return null;
  }

  if (result.status !== 200 || !result.payload) {
    record(
      "version",
      false,
      `HTTP ${result.status} ${result.payload ? "" : "· not JSON (is “Who has access” set to Anyone?)"}`,
    );
    return null;
  }

  const { version, actions } = result.payload;
  const served = actions && typeof actions === "object" ? Object.values(actions).flat() : [];
  record(
    "version",
    version === "2.0.0",
    version === "2.0.0"
      ? `build ${version}`
      : `build "${version ?? "unknown"}" — expected 2.0.0 ${preview(served)}`,
  );

  const missingCustomer = CUSTOMER_ACTIONS.filter((a) => !served.includes(a));
  const missingAdmin = ADMIN_ACTIONS.filter((a) => !served.includes(a));
  record(
    "actions",
    missingCustomer.length === 0 && missingAdmin.length === 0,
    missingAdmin.length === 0
      ? missingCustomer.length === 0
        ? "all customer and admin actions served"
        : `missing customer: ${missingCustomer.join(", ")}`
      : `missing admin: ${missingAdmin.join(", ")}`,
  );

  return served;
}

async function checkPublicRead() {
  let result;
  try {
    result = await call("getPublicItems");
  } catch (error) {
    record("getPublicItems", false, `unreachable (${error.message})`);
    return null;
  }
  const items = Array.isArray(result.payload?.items) ? result.payload.items : null;
  if (result.payload?.success !== true || !items) {
    record("getPublicItems", false, preview(result.payload ?? result.text));
    return null;
  }
  const bad = items.filter((item) => !("id" in item && "name" in item && "stock" in item && "price" in item));
  record(
    "getPublicItems",
    bad.length === 0,
    bad.length === 0 ? `${items.length} items` : `${bad.length} items with unexpected fields`,
  );
  return items;
}

async function checkCustomerValidation(items) {
  // A blank itemId is rejected before anything is written, so this exercises the
  // customer write path without placing a real order.
  let result;
  try {
    result = await call("placeOrder", {
      method: "POST",
      body: { itemId: "", quantity: 1 },
    });
  } catch (error) {
    record("placeOrder rejects", false, `unreachable (${error.message})`);
    return;
  }
  record(
    "placeOrder rejects",
    result.payload?.success === false,
    preview(result.payload ?? result.text),
  );

  const sample = items?.[0];
  if (!sample) return;
  try {
    result = await call("placeOrder", { method: "POST", body: { itemId: sample.id, quantity: 0 } });
    record(
      "placeOrder quantity",
      result.payload?.success === false,
      preview(result.payload ?? result.text),
    );
  } catch (error) {
    record("placeOrder quantity", false, `unreachable (${error.message})`);
  }
}

async function checkAdminRejectsKey() {
  // A wrong key must be refused. Nothing is read or written either way.
  let result;
  try {
    result = await call("getItems", { adminKey: "definitely-not-the-key" });
  } catch (error) {
    record("admin rejects bad key", false, `unreachable (${error.message})`);
    return;
  }
  record(
    "admin rejects bad key",
    result.payload?.success === false,
    preview(result.payload?.message ?? result.payload ?? result.text),
  );
}

async function checkAdminReads() {
  if (!ADMIN_KEY) {
    skip("admin actions", "set ADMIN_KEY to also check the protected actions");
    return null;
  }

  for (const [action, field] of [
    ["getItems", "items"],
    ["getOrders", "orders"],
    ["adminStats", "stats"],
  ]) {
    let result;
    try {
      result = await call(action, { adminKey: ADMIN_KEY });
    } catch (error) {
      record(action, false, `unreachable (${error.message})`);
      continue;
    }
    const value = result.payload?.[field];
    const size = Array.isArray(value) ? value.length : value ? "1 object" : "none";
    record(
      action,
      result.payload?.success === true && value !== undefined,
      result.payload?.success === true ? `${size} · ${preview(result.payload.message ?? "")}` : preview(result.payload ?? result.text),
    );
  }
}

async function checkAdminWrites() {
  if (!ADMIN_KEY) return;

  // Each write below is guaranteed to abort on validation or a missing row, so
  // the actions are routed and authorised without changing a single cell.
  const probes = [
    ["addItem", { name: "", stock: -1, price: 0 }, "rejects bad product"],
    ["updateItem", { itemId: "__does_not_exist__", name: "x" }, "rejects unknown item"],
    ["setStock", { itemId: "__does_not_exist__", stock: 3 }, "rejects unknown item"],
    ["deleteItem", { itemId: "__does_not_exist__" }, "rejects unknown item"],
    [
      "updatePayment",
      { orderId: "__does_not_exist__", itemId: "__does_not_exist__", paymentStatus: "Pending" },
      "rejects unknown order",
    ],
  ];

  for (const [action, payload, label] of probes) {
    let result;
    try {
      result = await call(action, { method: "POST", body: { ...payload, adminKey: ADMIN_KEY } });
    } catch (error) {
      record(label, false, `unreachable (${error.message})`);
      continue;
    }
    record(
      label,
      result.payload?.success === false,
      preview(result.payload?.message ?? result.payload ?? result.text),
    );
  }
}

async function main() {
  console.log("Checking the Samson Cafe Apps Script deployment\n");
  const served = await checkVersion();
  if (!served) {
    finish();
    return;
  }
  const items = await checkPublicRead();
  await checkCustomerValidation(items);
  await checkAdminRejectsKey();
  await checkAdminReads();
  await checkAdminWrites();
  finish();
}

function finish() {
  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length > 0) {
    console.log(
      "\nThe deployment above is not the v2 backend, or the admin key does not match. " +
        "Redeploy the Apps Script web app, point GOOGLE_SCRIPT_URL at its /exec URL, and " +
        "make sure ADMIN_KEY matches SAMSON_ADMIN_KEY. See README.md.",
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`check failed: ${error.message}`);
  process.exitCode = 1;
});
