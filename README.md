# Samson Cafe

A mobile-first cafe menu and ordering flow with separate `/admin` management routes. Customers start directly on the menu and place one item per order through **Buy now → Product → Details → Confirm**. There is no cart.

## Run locally

This is a static single-page app. Run `npm run dev` and open `http://localhost:3000`; the included dependency-free server sends `/admin` paths to the app. A deployed Apps Script URL is required for the menu, checkout, and admin to work. If it is missing or unavailable, the app shows a configuration/connection error and does not substitute local or sample data.

## Connect the existing Google Sheet

1. Open the existing spreadsheet and copy its ID from the URL.
2. In **Extensions → Apps Script**, add the contents of `apps-script/Code.gs`.
3. The script defaults to the Samson Cafe spreadsheet ID in `apps-script/Code.gs`. The local source uses `admin1234` as the admin password unless `SAMSON_ADMIN_PASSWORD` is set in Apps Script **Project Settings → Script properties**. Set `SPREADSHEET_ID` there only if you want to use a different spreadsheet.
4. Confirm the existing tabs are named exactly `Items` and `Orders` and retain the specified five and six columns. The script does not rename or add sheet columns. Item enable/disable flags are kept in Apps Script properties.
5. Deploy as a **Web app**, execute as your account, and allow access to anyone. Copy the `/exec` URL.
6. Set `GOOGLE_SCRIPT_URL` in `config.js` to that URL and publish the frontend over HTTPS. Configure your static host to rewrite application routes to `index.html` (SPA fallback).

The Apps Script Web App is the only component that accesses Sheets. Customer orders append the exact six required Orders values and reduce Items column D under a script lock after rechecking current stock. Payment starts as `Pending`. Admin product updates write to Items; payment changes update Orders column F.

## API actions

The frontend calls the deployed web app using JSONP, with action and fields in query parameters. This avoids browser cross-origin preflight issues with Apps Script web apps.

- `getProducts` — public menu data from Items.
- `placeOrder` — accepts only `itemId` and `quantity`; validates current stock and price, calculates the total, writes exactly six Orders values, and decrements stock atomically.
- `adminChallenge` / `adminLogin` — verifies a one-time password proof and issues a short-lived admin session token.
- `getOrders` — protected Orders data.
- `createProduct` — protected; assigns the next `C###` ID and appends the five existing Items fields.
- `updateProduct` — protected; edits name, image, stock, price, and menu enable/disable state.
- `updateStock` — protected stock-only update.
- `updatePayment` — protected; changes the existing payment status cell to `Pending` or `Paid`.

The provided Orders sheet has no columns for customer contact, delivery address, pickup/delivery selection, or notes. To preserve its exact structure, those details are used to confirm the order in the current browser session and are not persisted to Sheets. Admin order details can resolve product names and images from Items, but cannot show customer details.

## Routes

- `/` — direct customer menu and checkout.
- `/admin/login` — admin sign-in.
- `/admin`, `/admin/products`, `/admin/orders`, `/admin/stock`, `/admin/reports` — admin screens.

Set the low-stock cutoff and currency once in `config.js`.

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
