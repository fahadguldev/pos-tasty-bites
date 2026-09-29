# Tasty Bites — Lodhran

A single-cafe ordering system: a customer-facing website, a WhatsApp order path, and one
admin dashboard that sees every order from either channel.

Home delivery only. No tables, no dine-in, no multi-tenant anything.

```
backend/    Express 5 + MongoDB API
frontend/   React 19 + Vite + Tailwind 4 web app (storefront and admin)
```

---

## What it does

**For customers**

- Browse the menu by category, search it, and open a product page with photos and reviews.
- See live deals and bundles; the saving is calculated server-side so it cannot be faked.
- Cart with server-side pricing — delivery fee, free-delivery threshold and the minimum
  order all come from the API, never from the browser.
- Order on the website (saved straight into the dashboard) or place the same order through
  WhatsApp with one tap.
- Track an order with just the order number and phone number. No account needed.
- Leave a rating; it waits for approval before it goes live.

**For staff**

- One queue for website, WhatsApp and counter orders, filterable by status, source and search.
- Move an order along `new → confirmed → preparing → out_for_delivery → delivered`, with
  illegal jumps rejected by the server.
- Track payments separately (`pending` / `received` / `refunded`) from delivery status.
- Download a PDF receipt for any order.
- Manage the menu: photos, sizes with their own prices, cost per item, spicy/vegetarian
  flags, availability toggle.
- Schedule deals with a start and end date — they go live and drop off on their own.
- Moderate reviews, watch daily/monthly revenue, profit, margin, best sellers and bundles
  that never sell.
- Change shop details, delivery fees, minimum order, payment accounts and social links.

---

## Running it locally

You need **Node 20+**. MongoDB is optional for a first look — see below.

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and at minimum set a JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Paste that into `JWT_SECRET`. Then:

```bash
npm run dev
```

The API listens on `http://localhost:4000`. Check it with
`http://localhost:4000/api/health`.

**No MongoDB installed?** Leave `MONGODB_URI` empty and the server starts a throwaway
in-memory MongoDB and seeds a full demo menu, deals, reviews and a month of orders into
it. Everything works, but the data is gone when you stop the server.

With a local MongoDB running, set `MONGODB_URI=mongodb://127.0.0.1:27017/tasty_bites`
instead. The first boot creates the shop settings and the admin account.

The first admin is `admin@tastybites.pk` / `tastybites123` unless you change
`ADMIN_EMAIL` / `ADMIN_PASSWORD`. **Change it from Settings after the first sign-in.**

To reset the demo data in a real database:

```bash
npm run seed
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The site runs on `http://localhost:5173`, the admin panel on
`http://localhost:5173/admin`.

The dev server calls `http://localhost:4000/api`. To point it somewhere else, copy
`frontend/.env.example` to `frontend/.env.local` and set `VITE_API_URL` — see
`VITE_API_URL` in the config table below.

---

## Tests

```bash
cd backend
npm test
```

This boots the API in-process against a throwaway MongoDB, seeds the demo menu, then walks
the whole flow — order creation, pricing, tracking, status transitions, receipts, reviews,
analytics and settings — and prints a pass/fail line for each check.

```bash
cd frontend
npm run typecheck   # tsc, no emit
npm run lint        # eslint
npm run build       # typecheck + production bundle
```

---

## Configuration

Everything is read from `backend/.env`. See `.env.example` for the annotated list.

| Variable | Required | What it does |
| --- | --- | --- |
| `PORT` | no | API port, default `4000` |
| `CLIENT_ORIGIN` | yes in production | Comma-separated origins allowed to call the API |
| `MONGODB_URI` | no | Leave empty to use the in-memory database |
| `JWT_SECRET` | **yes** | The server refuses to boot without it |
| `JWT_EXPIRES_IN` | no | Token lifetime, default `7d` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | no | The first admin account |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | no | Enables photo uploads |
| `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` | no | Enables automatic WhatsApp sending |

`VITE_API_URL` is the one frontend variable, read from `frontend/.env.local`. Vite inlines
it at build time, so a production change needs a rebuild.

### Photos

Uploads are disabled without the Cloudinary keys; the admin UI says so and you can paste an
image URL instead. The keys are in the Cloudinary dashboard.

### WhatsApp

There are two paths and both end up in the same dashboard:

- **Without credentials** — the order is saved, and the customer gets a `wa.me` link to tap
  and send. Nothing is sent by the server.
- **With `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`** — the server sends the order to
  the cafe's number on the customer's behalf, and records whether it went out.

The cafe's WhatsApp number itself is a shop setting, editable in **Admin → Settings**, not
an environment variable.

---

## Deploying

### Backend

Any Node host works — Railway, Render, Fly, a VPS with a process manager. Set the
environment variables above, point `MONGODB_URI` at a real MongoDB (Atlas works), and:

```bash
npm ci --omit=dev && npm start
```

Set `CLIENT_ORIGIN` to your site's real domain. The API rejects any other origin.

### Frontend

```bash
npm run build      # emits frontend/dist
```

`dist` is a static site — host it on Netlify, Vercel, Cloudflare Pages or any web server.
Set `VITE_API_URL` to your deployed API's `/api` URL **before** building; Vite inlines it at
build time.

If you host both on one domain, put the API behind `/api` and set `VITE_API_URL=/api` so
there is no CORS to configure.

---

## API reference

All routes are prefixed with `/api`. Admin routes need `Authorization: Bearer <token>`.

### Public

| Method | Route | Notes |
| --- | --- | --- |
| `GET` | `/health` | Liveness check |
| `GET` | `/settings` | Shop details and the *active* payment methods |
| `GET` | `/categories` | `?includeInactive=true` for admin use |
| `GET` | `/products` | `?category=`, `?search=`, `?featured=true`, `?withRating=true` |
| `GET` | `/products/:slugOrId` | Single product |
| `GET` | `/products/:slugOrId/reviews` | `{ reviews, summary }`, approved only |
| `GET` | `/deals` | Live deals only; `?includeAll=true` for admin use |
| `GET` | `/deals/:slugOrId` | Single deal |
| `GET` | `/deals/:slugOrId/reviews` | `{ reviews, summary }` |
| `POST` | `/orders/quote` | Prices a cart without creating anything |
| `POST` | `/orders` | Creates an order, returns `{ order, whatsapp }` |
| `POST` | `/orders/whatsapp-link` | Same, but hands back a `wa.me` link |
| `GET` | `/orders/track?orderNo=&phone=` | Customer-safe projection |
| `POST` | `/reviews` | Creates a review, unpublished |

### Admin

| Method | Route | Notes |
| --- | --- | --- |
| `POST` | `/auth/login` | `{ token, admin }` |
| `GET` | `/auth/me` | The current admin |
| `POST` | `/auth/change-password` | |
| `GET/POST/PUT/DELETE` | `/admin/categories[/:id]` | |
| `GET` | `/admin/products` | Includes sold-out items and ratings |
| `POST/PUT/DELETE` | `/admin/products[/:id]` | |
| `PATCH` | `/admin/products/:id/availability` | Server flips the flag and returns it |
| `GET` | `/admin/deals?includeAll=true` | Scheduled and finished bundles too |
| `GET` | `/admin/deals/timeline` | Bundles split into live / scheduled / finished |
| `POST/PUT/DELETE` | `/admin/deals/:id` | |
| `GET` | `/admin/orders` | `{ orders, total, page, pages }` |
| `GET` | `/admin/orders/:id` | |
| `PATCH` | `/admin/orders/:id/status` | `status`, `paymentStatus`, `cancelledReason` |
| `POST` | `/admin/orders/:id/whatsapp` | Re-send to the cafe |
| `GET` | `/admin/orders/:id/receipt` | PDF |
| `GET` | `/admin/reviews?approved=true\|false` | |
| `PATCH` | `/admin/reviews/:id/approve` | |
| `DELETE` | `/admin/reviews/:id` | |
| `GET` | `/admin/analytics/overview\|daily\|monthly\|top-products\|top-deals\|insights` | |
| `GET/PUT` | `/admin/settings` | |
| `POST` | `/admin/settings/seed-payment-methods` | Restores the default payment methods |
| `GET` | `/upload/status` | `{ cloudinary: boolean }` |
| `POST` | `/upload` | `multipart/form-data`, field name `image` |
| `DELETE` | `/upload` | `{ publicId }` |

### Conventions worth knowing

- **The server prices everything.** Carts, quotes, orders and deals are all priced from
  `Product`/`Deal` documents on request. Never trust totals sent by a client.
- **Order and deal lines use `kind`** (`product` or `deal`) plus a `ref` id, not a
  `type`/`refType` pair.
- **Photos are an array.** `images: [{ url, publicId }]`; the first is the cover.
- **Variants use `active`.** The price shown on a card is the cheapest active variant.
- **`.lean()` and virtuals.** `mongoose-lean-virtuals` is registered before any model is
  compiled, so `effectivePrice`, `savings`, `discountPercent`, `isLive` and `profit` are
  present on reads. Do not remove that import.
- **Review summaries return `buckets`**, keyed `"1"`–`"5"`.

---

## Layout

```
backend/
  index.js                    app + bootstrap, only listens when run directly
  src/config/                 mongoose plugin, db, cloudinary
  src/models/                 Admin, Category, Product, Deal, Order, Review, Setting, Counter
  src/controllers/            one file per resource
  src/services/               pricing, whatsapp, receipt
  src/utils/format.js         shared server-side formatters
  src/middleware/             auth, upload, asyncHandler
  src/seed/seed.js            demo menu, deals, reviews, orders
  src/smoke.js                the end-to-end test
frontend/
  src/lib/types.ts            the API contract, mirrored exactly
  src/lib/api.ts              axios instance, auth header, helpers
  src/lib/apiClient.ts        one typed function per endpoint
  src/lib/format.ts           status, payment and source labels
  src/components/store/       storefront shell, cards, cart
  src/components/admin/       product/deal form, image uploaders
  src/components/ui/          buttons, badges, modal, field, icons
  src/pages/store/            home, menu, product, deals, checkout, track, about
  src/pages/admin/            dashboard, orders, products, deals, reviews, analytics, settings
  src/store/                  cart and admin session (zustand, persisted)
```

---

## Not included

- Card payments are recorded as a payment method only — no gateway is wired up.
- No table ordering, no kitchen display, no delivery rider tracking.
- Cloudinary and WhatsApp need third-party accounts before those features turn on.
