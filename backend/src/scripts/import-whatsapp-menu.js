/**
 * Push the menu read off the WhatsApp photos into the API.
 *
 *   node src/scripts/import-whatsapp-menu.js            preview only, writes nothing
 *   node src/scripts/import-whatsapp-menu.js --apply    write the changes
 *
 * The API must be reachable (API_URL, default http://localhost:4000/api) and
 * you need admin credentials in backend/.env.
 *
 * Idempotent: products and deals are matched by name, and only the fields that
 * actually differ are sent, so descriptions, costs, tags, images and dates
 * already in the database survive a re-run.
 */
import dotenv from 'dotenv';
import { CATEGORIES, PRODUCTS, DEALS, dealImageUrl } from '../seed/whatsappMenu.js';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const BASE = process.env.API_URL || `http://localhost:${process.env.PORT || 4000}/api`;
const ENDS_IN_DAYS = 90;

let token = '';

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const err = new Error(data?.error || `${method} ${path} -> ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const plan = [];
const record = (action, kind, label, detail) => plan.push({ action, kind, label, detail });
const priceOf = (p) => (p.variants?.length ? Math.min(...p.variants.map((v) => v.price)) : Number(p.price) || 0);
const fmt = (n) => `Rs. ${n}`;

function sameVariants(a, b) {
  const norm = (list) => JSON.stringify((list || []).map((v) => `${v.name}:${Number(v.price)}`));
  return norm(a) === norm(b);
}

/** Carry over `active` flags so re-importing never resurrects a hidden size. */
function mergeVariants(next, existing) {
  const activeByName = new Map((existing || []).map((v) => [v.name, v.active !== false]));
  return (next || []).map((v) => ({ name: v.name, price: v.price, active: activeByName.get(v.name) ?? true }));
}

async function ensureCategories() {
  const existing = await api('/admin/categories');
  const byName = new Map(existing.map((c) => [c.name, c]));

  for (const c of CATEGORIES) {
    if (byName.has(c.name)) continue;
    record('create', 'category', c.name, 'new section from the printed menu');
    // during a dry run nothing is created, so hold a placeholder that lets the
    // product pass continue to be planned (it is never sent to the API)
    const created = APPLY
      ? await api('/admin/categories', { method: 'POST', body: c })
      : { _id: `new:${c.name}`, name: c.name };
    byName.set(c.name, created);
  }
  return byName;
}

async function syncProducts(categoryByName) {
  const existing = await api('/admin/products');
  const byName = new Map(existing.map((p) => [p.name, p]));

  for (const item of PRODUCTS) {
    const categoryId = categoryByName.get(item.category)?._id;
    if (!categoryId) throw new Error(`Category not found: ${item.category}`);

    const current = byName.get(item.name);
    const variants = item.variants ? mergeVariants(item.variants, current?.variants) : undefined;
    const price = variants ? Math.min(...variants.map((v) => v.price)) : item.price;

    if (!current) {
      const body = { name: item.name, category: categoryId, price, ...(variants ? { variants } : {}) };
      if (item.description) body.description = item.description;
      record('create', 'product', item.name, `${item.menuLabel} — ${fmt(price)}`);
      if (APPLY) {
        const created = await api('/admin/products', { method: 'POST', body });
        byName.set(created.name, created);
      } else {
        // placeholder so deal planning can resolve the reference; never sent
        byName.set(item.name, { _id: `new:${item.name}`, name: item.name });
      }
      continue;
    }

    const body = {};
    if (current.category?._id !== categoryId) body.category = categoryId;
    if (variants && !sameVariants(current.variants, variants)) body.variants = variants;
    if (price !== Number(current.price)) body.price = price;
    if (item.description && item.description !== current.description) body.description = item.description;

    if (!Object.keys(body).length) continue;

    const changes = [];
    if (body.price !== undefined) changes.push(`${fmt(current.price)} → ${fmt(price)}`);
    if (body.variants) changes.push(`sizes → ${variants.map((v) => `${v.name} ${fmt(v.price)}`).join(', ')}`);
    if (body.category) changes.push(`category → ${item.category}`);
    if (body.description) changes.push('description added');

    record('update', 'product', item.name, changes.join('; '));
    if (APPLY) {
      const updated = await api(`/admin/products/${current._id}`, { method: 'PUT', body });
      byName.set(updated.name, updated);
    }
  }

  return byName;
}

async function syncDeals(productByName) {
  const existing = await api('/admin/deals?includeAll=true');
  const byName = new Map(existing.map((d) => [d.name, d]));
  const endsAt = new Date(Date.now() + ENDS_IN_DAYS * 86400000).toISOString();

  for (const deal of DEALS) {
    const items = deal.items.map((i) => {
      const product = productByName.get(i.product);
      if (!product) throw new Error(`Deal "${deal.name}" references missing product "${i.product}"`);
      return { product: product._id, qty: i.qty, unitPrice: i.unitPrice };
    });

    const image = dealImageUrl(deal);
    const compareAt = items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
    const current = byName.get(deal.name);

    if (!current) {
      record('create', 'deal', deal.name, `${fmt(deal.price)} (was ${fmt(compareAt)})${image ? ' + poster' : ''}`);
      if (APPLY) {
        const created = await api('/admin/deals', {
          method: 'POST',
          body: { ...deal, image, endsAt, items, compareAtPrice: undefined },
        });
        byName.set(created.name, created);
      }
      continue;
    }

    const body = {};
    if (Number(current.price) !== Number(deal.price)) body.price = deal.price;
    if (deal.description && deal.description !== current.description) body.description = deal.description;
    if (deal.badge !== undefined && deal.badge !== current.badge) body.badge = deal.badge;
    if (image && image !== current.image) body.image = image;
    if (!sameLineItems(current.items, items)) body.items = items;

    if (!Object.keys(body).length) continue;

    const changes = [];
    if (body.price !== undefined) changes.push(`${fmt(current.price)} → ${fmt(deal.price)}`);
    if (body.image) changes.push('poster attached');
    if (body.items) changes.push(`bundle → ${items.length} lines`);
    record('update', 'deal', deal.name, changes.join('; '));

    if (APPLY) {
      const updated = await api(`/admin/deals/${current._id}`, { method: 'PUT', body });
      byName.set(updated.name, updated);
    }
  }
}

/**
 * `items.product` arrives populated as an object from the list endpoint, so
 * compare on the id whichever shape it is in.
 */
const productId = (p) => String(p?._id ?? p ?? '');

function sameLineItems(current, next) {
  if (!current?.length || current.length !== next.length) return false;
  return current.every(
    (c, i) => productId(c.product) === productId(next[i].product)
      && c.qty === next[i].qty
      && Number(c.unitPrice) === Number(next[i].unitPrice),
  );
}

async function main() {
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — ${BASE}`);

  token = (await api('/auth/login', {
    method: 'POST',
    body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
  })).token;

  const categoryByName = await ensureCategories();
  const productByName = await syncProducts(categoryByName);
  await syncDeals(productByName);

  if (!plan.length) {
    console.log('\nNothing to do — the database already matches the printed menu.');
    return;
  }

  const width = Math.max(...plan.map((p) => p.label.length));
  const plurals = { category: 'CATEGORIES', product: 'PRODUCTS', deal: 'DEALS' };
  for (const kind of ['category', 'product', 'deal']) {
    const rows = plan.filter((p) => p.kind === kind);
    if (!rows.length) continue;
    console.log(`\n${plurals[kind]} (${rows.length})`);
    for (const r of rows) console.log(`  ${r.action.padEnd(6)} ${r.label.padEnd(width)}  ${r.detail}`);
  }

  const counts = plan.reduce((acc, p) => ({ ...acc, [p.action]: (acc[p.action] || 0) + 1 }), {});
  console.log(`\n${counts.create || 0} to create, ${counts.update || 0} to update.`);
  if (!APPLY) console.log('Dry run — nothing was written. Re-run with --apply to commit.');
}

main().catch((err) => {
  console.error(`\nImport failed: ${err.message}`);
  if (err.message.includes('ECONNREFUSED')) console.error(`Is the API running? Tried ${BASE}`);
  process.exitCode = 1;
});
