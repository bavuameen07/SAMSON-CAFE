# Samson Cafe

A mobile-first cafe menu and ordering flow with separate `/admin` management routes. Customers start directly on the menu and place one item per order through **Buy now → Product → Confirm**. There is no cart, and no customer details are collected.

## Run locally

This is a Next.js App Router app. Run `npm run dev` and open `http://localhost:3000`; `/admin` redirects to `/admin/login` until you sign in. A deployed Apps Script URL is required for the menu, checkout, and admin to work. If it is missing or unavailable, the app shows the specific configuration or connection error and does not substitute local or sample data.

## The Google Sheet

The Sheets API is a **deployed Apps Script web app (v2.0.0)** that reads and writes the existing `Items` and `Orders` tabs. This repository talks to that deployment over HTTPS; it does not touch Sheets directly and it does not generate menu, order or dashboard data.

The tabs keep their existing columns — Items `id, name, image, stock, price` and Orders `orderId, itemId, quantity, totalAmount, dateTime, paymentStatus`. Nothing is renamed, reordered or added. Timestamps are stored as `DD-MM-YYYY HH:mm:ss`, which `lib/format.ts` parses for display, filtering and sorting.

`apps-script/Code.gs` in this repository is a **historical copy of an older contract and is not what is deployed.** It still speaks the pre-v2 action names and the nonce/proof admin handshake that v2 replaced. Do not paste it into the Apps Script editor — doing so would overwrite the working v2 backend with the old one and break the admin dashboard. See **Deploying the Apps Script web app** below.

## Environment variables

`lib/config.ts` reads these at server start. None is `NEXT_PUBLIC_`, and none reaches the browser: `lib/config.ts` imports `server-only`, and only `displaySettings()` crosses into client components.

| Variable | Purpose | Required |
| --- | --- | --- |
| `GOOGLE_SCRIPT_URL` | The deployed `/exec` web app URL. | No — falls back to the v2 URL in `lib/config.ts` |
| `ADMIN_KEY` | Admin key. Must match `SAMSON_ADMIN_KEY` in Apps Script. | **Yes** |
| `AUTH_SECRET` | Signs the admin session cookie. Changing it signs admins out. | **Yes** |

Because these are read at server start, **changing any of them requires restarting the Next.js dev server.**

`ADMIN_KEY` and `AUTH_SECRET` have **no built-in default**. An earlier revision committed both the admin key and the cookie-signing secret as fallbacks, which meant anyone holding the repository could sign in to `/admin` and forge an admin session cookie outright. Both now come from the environment only.

If either is missing, `/admin` is unavailable and the app says which one is unset rather than falling back to something weak:

- No `ADMIN_KEY` — `/admin/login` reports that no admin key is configured; admin API calls fail with a matching message.
- No `AUTH_SECRET` — no session can be signed, so `/admin` redirects to `/admin/login`.

`AUTH_SECRET` is deliberately not allowed to fall back to the admin key: reusing the API credential for cookie signing would mean one leaked value opens both doors.

## Admin authentication

The admin key authorises the **API**, and it never reaches the browser:

1. `/admin/login` posts the entered key to a server action.
2. The server compares it against `ADMIN_KEY` with `timingSafeEqual`, then makes one authenticated call to prove the backend accepts it.
3. Only then does it set a signed, httpOnly, `SameSite=Lax` admin cookie.
4. Every later admin request carries only that cookie; the server attaches `ADMIN_KEY` itself when calling Apps Script.

`/admin` pages call `requireAdmin()` and admin server actions call `assertAdmin()`, so the area is unreachable without a valid cookie. No admin request is ever built in a client component, which keeps the key out of the bundle, out of URLs and out of anything a customer can read.

## API actions

The server calls the deployed web app directly. Reads are `GET`s with the action in the query string; writes are `POST`s with `Content-Type: text/plain;charset=utf-8` and a JSON body. The action travels **in the POST body** as well as the query string — this deployment reads POST parameters from the parsed body, and a POST with the action only in the URL is answered `"Unknown POST action"`.

Every response is `{ success: true, … }` or `{ success: false, message: "…" }`, always with HTTP 200, so `success` is the only reliable error signal and it is handled once in `lib/sheets.ts`.

Customer:

- `getPublicItems` — the public menu from Items.
- `placeOrder` — accepts only `itemId` and `quantity`; the backend derives price, total and payment status from the sheet, appends one Orders row and decrements stock under a lock. Orders start as `Pending`.

Admin (each needs `adminKey` — in the query string on a `GET`, in the body on a `POST`):

- `getItems` — every item.
- `getOrders` — every order, newest first.
- `adminStats` — the dashboard figures: `totalItems`, `totalStock`, `lowStockItems`, `outOfStockItems`, `totalOrders`, `pendingOrders`, `paidOrders`, `cancelledOrders`, `totalSales`.
- `addItem`, `updateItem`, `setStock`, `deleteItem` — Items writes.
- `updatePayment` — accepts `orderId`, `itemId` and `paymentStatus`, one of `Pending`, `Paid`, `Failed`, `Cancelled`.

A wrong or missing key is refused with `{ "success": false, "message": "Unauthorized admin request" }`.

Two consequences of this contract are visible in the UI: there is no enable/disable state, so availability is decided by stock alone and a sold-out item cannot be ordered; and the dashboard figures come from `adminStats` rather than being counted in the browser, so the overview cannot disagree with the sheet.

The provided Orders sheet has no columns for customer contact, delivery address, pickup/delivery selection, or notes. To preserve its exact structure, those details are not collected and not persisted to Sheets. Admin order details resolve product names and images from Items.

## Routes

- `/` — direct customer menu and checkout.
- `/admin/login` — admin sign-in.
- `/admin`, `/admin/products`, `/admin/orders`, `/admin/stock`, `/admin/reports` — admin screens.

Set the low-stock cutoff and currency once in `displaySettings()` in `lib/config.ts`.

## Product images

Every menu item gets its own photograph, resolved from the product name. Nothing is hand-assigned and nothing is random:

```
product name -> dish + flavour modifiers -> signature -> prompt -> image URL
```

- `lib/product-image-prompts.ts` turns a name into a dish description, a stable signature (`vanilla-latte`), a photography prompt and the alt text. It covers the whole cafe menu — espresso through cheesecake — and falls back to describing the name itself, so a dish the table has never seen still gets a matching picture.
- `lib/product-images.ts` resolves that plan to a URL in a fixed order: an image URL already in the Items sheet, then the generated photo in `public/menu`, then the image generator configured in `lib/config.ts`, then the cafe fallback photo. The outcome is a pure function of the product name, so a product's picture never changes between renders, requests or deploys, and nothing is generated while a page is rendering.
- The generator request is seeded from the signature, so a product added to the Google Sheet with an empty image cell resolves to the same picture on every visit without any code change.
- `components/product-image.tsx` renders local assets through `next/image` for responsive sources, modern formats, lazy loading and a reserved aspect ratio, and falls back to the cafe photo if an image fails to load, so a broken icon never appears.

Regenerate or add the committed photos with:

```
npm run images             # every product currently in the sheet
npm run images "Vanilla Latte"
npm run images -- --force  # rebuild photos that already exist
npm run images:fallback    # the cafe fallback photo
npm run images:check       # no two product names share a picture
```

Add a `token` to `config.imageGenerator` in `lib/config.ts` if the generator needs an account. The browser never sends it — a token the client can read is not a secret — so an authenticated generator can only produce committed photos through this tool; with `public/menu` in place the storefront serves those and never calls the generator at request time.

## Deploying the Apps Script web app

The menu, the admin dashboard, orders, stock and reports all talk to **one** Google Apps Script web app. Editing any source file in this repository does not change the running deployment: Apps Script keeps serving whichever version was last deployed, and each new deployment issues a **new** URL.

There is exactly one configured endpoint in this project — `config.googleScriptUrl` in `lib/config.ts`, overridable with `GOOGLE_SCRIPT_URL`. No page or component builds a request itself; `lib/sheets.ts` is the only module that talks to Apps Script.

### Checking what a deployment serves

```
npm run script:check
```

It resolves the URL from `GOOGLE_SCRIPT_URL`, falling back to `lib/config.ts`, and reports the build, the served action list, and a probe of each action. Set `ADMIN_KEY` to include the admin actions:

```
$env:ADMIN_KEY="…"; npm run script:check
```

The script never prints the key, never logs it, and never writes to the spreadsheet. Its probes are chosen to abort on validation or a missing row: `placeOrder` is sent a blank `itemId` and then `quantity: 0`, `addItem` a blank name, and `updateItem` / `setStock` / `deleteItem` / `updatePayment` an id that does not exist. A wrong key is checked separately, which must be refused. So a full pass proves every action is routed and authorised without placing or changing an order.

A healthy run looks like:

```
endpoint               PASS  lib/config.ts · /exec
version                PASS  build 2.0.0
actions                PASS  all customer and admin actions served
getPublicItems         PASS  8 items
placeOrder rejects     PASS  {"success":false,"message":"itemId is required"}
…
```

`npm run script:check` alone runs the same check through **TRY AGAIN** on the admin error page, via `diagnoseSheetsAction`, so a failed connection can be retried in place. That diagnostic is deliberately unauthenticated: it reads only the deployment's own version and action list, which is not privileged, and returns no sheet data and no key.

### Redeploying

1. Open <https://script.google.com> and open the Samson Cafe project.
2. Update `Code.gs` in the editor to the v2 source. **Do not paste `apps-script/Code.gs` from this repository** — it is an older contract and would replace the working backend.
3. **Deploy > New deployment**, type **Web app**, **Execute as** **Me** and **Who has access** **Anyone**. "Anyone" is required, because customers place orders without a Google account.
4. Copy the new **Web app URL** into `GOOGLE_SCRIPT_URL` in `.env.local`, or into `config.googleScriptUrl` in `lib/config.ts` if you do not use an env file. It must end in `/exec`.
5. Run `npm run script:check`. Every line must read `PASS` before `/admin` is reloaded.
6. On Vercel, set `GOOGLE_SCRIPT_URL` (Settings > Environment Variables) and redeploy. The env var overrides the literal in `lib/config.ts`, so a redeploy of the script needs no source change and no commit. Confirm the Vercel deployment is serving the new build before signing in.

Redeploying adds a deployment and leaves older versions in place, so spreadsheet data is untouched: every version reads and writes the same `Items` and `Orders` tabs and never renames, reorders or adds columns. Once the new URL is confirmed working, older deployments can be deleted from **Deploy > Manage deployments**.

### Script properties

Set in the Apps Script editor under **Project Settings > Script Properties**:

| Property | Purpose |
| --- | --- |
| `SPREADSHEET_ID` | Spreadsheet to serve, when it is not the default cafe spreadsheet. |
| `SAMSON_ADMIN_KEY` | The admin key. `ADMIN_KEY` on the server — or `config.adminKey` in `lib/config.ts` — must match it, or every admin call is refused with "Unauthorized admin request". |

When the two disagree, `/admin/login` says so explicitly after verifying the submitted key against the configured one, instead of reporting a generic connection failure.
