# Tasty Bites

A restaurant commerce platform with a public storefront, a full admin console, and WhatsApp-native ordering — catalog, cart, checkout, deals, campaigns, reviews, expenses, analytics, and a queue-backed WhatsApp messaging worker.

- **Repository:** https://github.com/fahadguldev/pos-tasty-bites
- **Live URL:** none published (ships a `vercel.json`; local dev only)

## Project Overview

Two packages in one repo:

| Directory | Package | Role |
| --- | --- | --- |
| `backend/` | `tasty-bites-api` v2.0.0 | Express + Mongoose API, WhatsApp transport, background worker |
| `frontend/` | `tasty-bites-web` v2.0.0 | React + TypeScript + Vite storefront and admin console |

The storefront lets a customer browse the menu, add to cart, check out, track an order, and place orders through WhatsApp. The admin console manages products, categories, orders, deals, contacts, campaigns, reviews, expenses, settings, and analytics.

## Problem & Solution

Small restaurants want online ordering without paying a marketplace commission per order, and they want customers to reach them on WhatsApp — the channel they already answer.

Tasty Bites keeps the whole pipeline in one system: the customer can either check out in-app or hand off to WhatsApp (`WhatsAppOrderCta`, `WhatsAppOrder.tsx`); either path lands in the same `Order` collection. Marketing (campaigns, deals, contacts) and the books (expenses, analytics) live in the same admin console, so there is no second tool to reconcile against.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS (`@tailwindcss/vite`), React Router |
| UI & Motion | `react-hot-toast`, Recharts, custom icon set (`components/ui/Icons.tsx`) |
| State | Zustand (`store/cart.ts`, `store/admin.ts`) |
| Backend | Express, `express-rate-limit`, `asyncHandler` wrapper, cookie auth |
| Database | MongoDB via Mongoose + `mongoose-lean-virtuals` |
| WhatsApp | `@open-wa/driver-puppeteer` (WhatsApp Web automation) |
| Documents | `pdfkit` (receipts) |
| Media | Cloudinary (`config/cloudinary.js`, `middleware/upload.js`) |
| Worker | Long-running queue process (`src/worker/index.js`) |
| Tooling | `node --watch`, Vite, `tsc -b`, ESLint, TypeScript strict (`typecheck`) |
| Infra | `vercel.json`, seed scripts, smoke test suite (`smoke.js`, 44 KB) |

## System Architecture

```
                      frontend (Vite, React + TS)
        +-----------------------------+----------------------------+
        |  pages/store/               |  pages/admin/              |
        |  Home Menu ProductDetail    |  Dashboard Products Orders |
        |  Deals Checkout Track       |  Campaigns Contacts Deals  |
        |  WhatsAppOrder About        |  Expenses Analytics Reviews|
        |                             |  Settings Login Layout     |
        |  store/cart.ts  store/admin.ts   lib/apiClient.ts        |
        +-----------------------------+----------------------------+
                                 |  REST
                                 v
   backend (Express) -----------------------------------------
     routes/index.js  ->  12 controllers
       auth product order deal category review
       expense settings campaign contact upload analytics
     middleware/  auth.js, upload.js, asyncHandler.js
     services/    pricing, receipt, template, audience, campaign,
                  sending, inbound, transport, openwaTransport,
                  whatsapp, whatsappStatus, whatsappLog,
                  contactBackfill
     models/      Admin Product Category Order Deal Contact
                  Campaign Review Expense Setting Counter
                  MessageLog SendJob WhatsappSession
                                 |
                     +-----------+-----------+
                     v                       v
                [ MongoDB ]   ->   worker/index.js (queue)
                                          |
                                   @open-wa / Puppeteer
                                   WhatsApp Web session
```

The queue split matters: `SendJob` rows are written by the API, and `src/worker/index.js` drains them asynchronously so a WhatsApp send never blocks an HTTP response.

## Key Features

- **Public storefront** — menu browsing, product detail, deals page, cart drawer, checkout, order tracking (`pages/store/`).
- **WhatsApp ordering** — a WhatsApp CTA on the cart/product path hands the customer to a prefilled WhatsApp thread with the order payload; inbound replies are parsed by `services/inbound.js`.
- **WhatsApp campaign engine** — contact import, audience segmentation (`services/audience.js`), templated messages (`services/template.js`), throttled sending (`services/sending.js`), and per-message status callbacks (`whatsappStatus.js`, `whatsappLog.js`, `MessageLog`).
- **Full admin console** — dashboard, product CRUD with image upload, order lifecycle, deals, categories, reviews, expenses, and store settings.
- **Order management** — `orderController` handles creation, status transitions, per-store and per-user lookups.
- **Analytics** — `analyticsController.js` (15.7 KB) aggregates revenue/order/traffic figures; rendered with Recharts in `AdminAnalytics.tsx`.
- **Receipts** — `services/receipt.js` renders PDFs with `pdfkit`.
- **Pricing rules** — `services/pricing.js` centralizes discount/deal math so cart, order, and receipt agree.
- **Expense tracking** — `Expense` model + `AdminExpenses.tsx` for day-to-day outgoings.
- **Rate limiting** — `express-rate-limit` wired in the API.
- **Seed + maintenance scripts** — `seed` (24.8 KB with menu data), `import:menu`, `backfill:contacts`, `probe:whatsapp` (QR login probe), `probe:wapi-surface`.
- **Smoke tests** — `npm test` runs `src/smoke.js`, a 44 KB end-to-end script covering the API surface.

## Setup & Run

```bash
git clone https://github.com/fahadguldev/pos-tasty-bites
cd pos-tasty-bites/backend
npm install
npm run seed            # load menu/catalog data
npm run dev             # node --watch index.js   (API)
npm run worker          # node src/worker/index.js (WhatsApp queue)
```

WhatsApp needs an active session first:

```bash
npm run probe:whatsapp  # prints a QR code, scan with your phone
npm run import:menu     # optional: import menu from WhatsApp
npm run backfill        # backfill contacts
npm test                # smoke test against the running API
```

Frontend:

```bash
cd ../frontend
npm install
npm run dev             # Vite dev server
npm run typecheck       # tsc -b --noEmit
npm run build           # tsc -b && vite build
```

Environment: MongoDB URI, Cloudinary credentials (`cloud_name`, `api_key`, `api_secret`), and the WhatsApp driver settings. `.env` is gitignored; no example file ships with the repo.

## Technical Decisions

- **`@open-wa/driver-puppeteer` over a cloud WhatsApp API.** Free and self-hosted, at the cost of running a real browser and maintaining a logged-in session — which is why `probe-openwa-qr.js` and `WhatsappSession` exist.
- **A separate worker process instead of in-request sending.** WhatsApp sends are slow and rate-limited. Writing `SendJob` rows and draining them in `worker/index.js` keeps the API responsive and makes retries possible.
- **`asyncHandler` wrapper around every controller.** Express 4 does not catch async rejections; the wrapper forwards them to `middleware/errorHandler.js` instead of hanging the request.
- **Zustand for cart state.** A cart is a small, hot, purely client store — Redux or server-state tooling would be overhead.
- **`mongoose-lean-virtuals`.** Lean queries skip Mongoose document hydration (a real cost on product lists) while still exposing computed virtuals like price formatting.
- **Separate `admin` vs `store` route trees.** One `App.tsx` shell, two disjoint page sets — an admin never accidentally ships into the storefront router.
- **Structured scripts over a Makefile.** `dev` / `start` / `worker` / `seed` / `backfill` / `import:menu` / `probe:*` map one-to-one to operational jobs.

## Challenges & Solutions

- **WhatsApp Web sessions are brittle.** Puppeteer-driven sessions die on restarts or phone disconnects. The answer was `probe:whatsapp` (explicit QR bootstrap), `whatsappStatus.js` (health reporting), and `SendJob` persistence so queued messages survive a worker crash.
- **Contact lists start empty.** `services/contactBackfill.js` plus `scripts/backfill-contacts.js` reconstruct the contact graph from existing orders/messages rather than requiring a manual import.
- **One price, three calculations.** Cart, order confirmation, and PDF receipt all needed identical math — solved by extracting `services/pricing.js` as the single source and having `receipt.js` consume it.
- **Inbound vs outbound message confusion.** `inbound.js` parses customer replies and `sending.js` dispatches outbound templates; keeping them in separate services with separate models (`WhatsappSession` vs `SendJob`) avoids echoing outbound messages back in as inbound events.
- **Catalog size.** `seed.js` is 24.8 KB and `whatsappMenu.js` 14.4 KB — generated/pasted data was too large to maintain by hand, so it moved into seed scripts.

## Honest Gaps

- **No committed `.env.example`.** Mongo URI, Cloudinary, and WhatsApp settings are all required but not documented in the repo; a newcomer has to read `config/*.js` to discover them.
- **A committed WhatsApp screenshot directory.** The repo contains `WhatsApp Unknown 2026-09-30 at 14.51.55/` — captured session screenshots that should not be in version control and may contain chat content.
- **No CI pipeline.** Unlike `task-manager`, this repo has no `.github/workflows`; the only verification is the manual `smoke.js` run.
- **No unit tests.** `npm test` is a smoke script against a live server, not an assertion suite — there is no coverage reporting and no offline test run.
- **`vercel.json` exists but no live URL is published.** The Puppeteer-based worker also cannot run on Vercel's serverless model, so a full deployment needs a separate host for the worker.
- **Repository history is a single squashed commit**, so the code shows no review or refactor history.
- **`express` version is not pinned to a major in a lockfile-free view of intent** — `package-lock.json` pins it, but the README does not state which major is targeted.

## Deployment Status

| Surface | URL | Status |
| --- | --- | --- |
| Storefront | — | not deployed |
| API | — | not deployed |
| Worker | — | must be self-hosted (Puppeteer) |

## Lessons Learned

- Background messaging work belongs in a queue process, not an HTTP handler — that single split is the difference between an API that answers in 40 ms and one that hangs for six seconds.
- Automation against a consumer app (WhatsApp Web) always needs a human bootstrap step: expose it as an explicit command with clear output rather than failing inside a server boot.
- When three surfaces must agree on a number, extract the calculation once and make all three call it.
- Shipping a big smoke script is better than nothing, but it should not be mistaken for a test suite — it needs a running server and asserts nothing in CI.
- Do not commit session screenshots: they are operational artifacts and carry user content.

## Author

**Muhammad Fahad** - [@fahadguldev](https://github.com/fahadguldev)

Repository: https://github.com/fahadguldev/pos-tasty-bites
