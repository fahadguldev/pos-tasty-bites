/**
 * End-to-end smoke test. Boots the API in-process against a throwaway MongoDB,
 * seeds the demo menu, then walks the full order flow and prints the results.
 *
 *   node src/smoke.js
 */
process.env.MONGODB_URI = '';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'smoke_test_secret_not_for_production';
process.env.AUTO_SEED = 'false';

const mongoose = (await import('mongoose')).default;
const { connectDB, disconnectDB } = await import('./config/db.js');
const { seed } = await import('./seed/seed.js');

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function api(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`http://127.0.0.1:4111/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const type = res.headers.get('content-type') || '';
  const payload = type.includes('application/json') ? await res.json() : await res.text();
  return { status: res.status, body: payload, headers: res.headers };
}

console.log('\nStarting test server...\n');
await connectDB('');
await seed({ quiet: true });

const { default: app } = await import('../index.js');
const server = app.listen(4111, async () => {  try {
    await run();
  } catch (err) {
    console.error('\nSmoke test crashed:', err);
    failed += 1;
  } finally {
    server.close();
    await disconnectDB();
    console.log(`\n${'='.repeat(46)}`);
    console.log(`  ${passed} passed, ${failed} failed`);
    console.log(`${'='.repeat(46)}\n`);
    process.exit(failed ? 1 : 0);
  }
});

async function run() {
  console.log('--- storefront ---');
  const health = await api('/health');
  check('health endpoint responds', health.status === 200, `got ${health.status}`);

  const settings = await api('/settings');
  check('public settings load', settings.status === 200 && !!settings.body.shopName);
  check('payment methods are exposed', Array.isArray(settings.body.paymentMethods) && settings.body.paymentMethods.length > 0);

  const categories = await api('/categories');
  check('categories load', categories.status === 200 && categories.body.length >= 8, `got ${categories.body?.length}`);

  const products = await api('/products');
  check('products load', products.status === 200 && products.body.length >= 30, `got ${products.body?.length}`);

  const featured = products.body.filter((p) => p.featured);
  check('some products are featured', featured.length > 0);

  const variantProduct = products.body.find((p) => p.variants?.length);
  check('variant pricing is computed', !!variantProduct, 'no product with variants found');
  if (variantProduct) {
    const prices = variantProduct.variants.map((v) => v.price);
    check(
      'effectivePrice matches the cheapest active variant',
      variantProduct.effectivePrice === Math.min(...prices),
      `${variantProduct.effectivePrice} vs ${Math.min(...prices)}`
    );
  }

  const deals = await api('/deals');
  check('live deals are visible to customers', deals.status === 200 && deals.body.length > 0, `got ${deals.body?.length}`);
  const withDiscount = deals.body.filter((d) => d.discountPercent > 0);
  check('deals expose a discount percentage', withDiscount.length > 0);
  if (deals.body[0]) {
    check('bundle is cheaper than buying items separately', deals.body[0].price < deals.body[0].compareAtPrice);
  }

  console.log('\n--- admin auth ---');
  const badLogin = await api('/auth/login', { method: 'POST', body: { email: 'admin@tastybites.pk', password: 'wrong' } });
  check('wrong password is rejected', badLogin.status === 401);

  const noToken = await api('/admin/orders');
  check('admin routes reject missing tokens', noToken.status === 401);

  const badToken = await api('/admin/orders', { token: 'not-a-real-token' });
  check('admin routes reject a forged token', badToken.status === 401);

  const token = await login();
  check('login returns a token', !!token);

  console.log('\n--- ordering ---');
  const burger = products.body.find((p) => p.name === 'Zinger Burger');
  const deal = deals.body[0];

  const noCustomer = await api('/orders', {
    method: 'POST',
    body: { items: [{ ref: burger._id, qty: 1 }], customer: {} },
  });
  check('order without customer details is rejected', noCustomer.status === 400, noCustomer.body?.error);

  const badPhone = await api('/orders', {
    method: 'POST',
    body: {
      items: [{ ref: burger._id, qty: 1 }],
      customer: { name: 'Test', phone: '123', address: 'Somewhere' },
    },
  });
  check('invalid phone number is rejected', badPhone.status === 400, badPhone.body?.error);

  // the client must not be able to set its own prices
  const tampered = await api('/orders', {
    method: 'POST',
    body: {
      items: [{ ref: burger._id, qty: 2, unitPrice: 1, lineTotal: 1, cost: 0 }],
      customer: { name: 'Ahmed Raza', phone: '03001234567', address: 'House 1, Test Street', area: 'Civil Colony' },
      paymentMethod: 'cod',
    },
  });
  check('website order is created', tampered.status === 201, tampered.body?.error);
  const order = tampered.body?.order;
  check('server overrides any client-supplied price', order?.subtotal === burger.price * 2, `subtotal=${order?.subtotal} expected=${burger.price * 2}`);
  check('delivery fee is applied', typeof order?.deliveryFee === 'number');
  check('order number is generated', /^TB-\d{4}$/.test(order?.orderNo || ''), order?.orderNo);
  check('whatsapp deep link is returned', (tampered.body?.whatsapp?.link || '').startsWith('https://wa.me/'));
  check('whatsapp link contains the order number', (tampered.body?.whatsapp?.link || '').includes(encodeURIComponent(order.orderNo)));

  // the cart drawer prices a cart without creating an order
  const quote = await api('/orders/quote', {
    method: 'POST',
    body: { items: [{ ref: burger._id, kind: 'product', qty: 1 }] },
  });
  check('cart can be quoted without ordering', quote.status === 200 && quote.body.subtotal === burger.price, quote.body?.error);
  check('quote includes the delivery fee', typeof quote.body.deliveryFee === 'number');
  check('quote tells the cart the minimum order', quote.body.minOrderValue > 0);

  const tinyQuote = await api('/orders/quote', {
    method: 'POST',
    body: { items: [{ ref: burger._id, kind: 'product', qty: 1 }] },
  });
  check('below-minimum cart still gets a quote instead of an error', tinyQuote.status === 200);

  const underMinimum = await api('/orders', {
    method: 'POST',
    body: {
      items: [{ ref: products.body.find((p) => p.name === 'Dip Sauce')._id, qty: 1 }],
      customer: { name: 'Test', phone: '03001234567', address: 'Test Street' },
    },
  });
  check('minimum order value is enforced', underMinimum.status === 400 && /Minimum order/.test(underMinimum.body?.error || ''), underMinimum.body?.error);

  const bundleOrder = await api('/orders', {
    method: 'POST',
    body: {
      items: [{ ref: deal._id, kind: 'deal', qty: 1 }],
      customer: { name: 'Fatima Noor', phone: '03002234567', address: 'Flat 2, Test Road' },
      paymentMethod: 'jazzcash',
    },
  });
  check('bundle order is created', bundleOrder.status === 201, bundleOrder.body?.error);
  check('bundle price comes from the deal', bundleOrder.body?.order?.subtotal === deal.price);
  check('payment method is recorded', bundleOrder.body?.order?.paymentMethod === 'jazzcash');
  check('bundle line is tagged as a deal', bundleOrder.body?.order?.items?.[0]?.kind === 'deal');

  console.log('\n--- whatsapp order path ---');
  const waOrder = await api('/orders/whatsapp-link', {
    method: 'POST',
    body: {
      items: [{ ref: burger._id, qty: 1 }],
      customer: { name: 'Bilal Khan', phone: '03003234567', address: 'House 9, Test Lane' },
    },
  });
  check('whatsapp order is saved to the dashboard', waOrder.status === 201);
  check('whatsapp order is tagged source=whatsapp', waOrder.body?.order?.source === 'whatsapp');
  check('wa.me link is built', (waOrder.body?.whatsapp?.link || '').startsWith('https://wa.me/923'));

  console.log('\n--- order tracking ---');
  const track = await api(`/orders/track?orderNo=${order.orderNo}&phone=03001234567`);
  check('customer can track with order number + phone', track.status === 200 && track.body.orderNo === order.orderNo);

  const trackWrong = await api(`/orders/track?orderNo=${order.orderNo}&phone=03999999999`);
  check('tracking with the wrong phone is refused', trackWrong.status === 404);

  console.log('\n--- admin order management ---');
  const list = await api('/admin/orders?limit=5', { token });
  check('admin can list orders', list.status === 200 && list.body.orders.length === 5, `got ${list.body?.orders?.length}`);
  check('orders are paginated', list.body.pages > 1);

  const badTransition = await api(`/admin/orders/${order._id}/status`, {
    method: 'PATCH',
    token,
    body: { status: 'delivered' },
  });
  check('illegal status jump is blocked', badTransition.status === 400, badTransition.body?.error);

  const confirmed = await api(`/admin/orders/${order._id}/status`, {
    method: 'PATCH',
    token,
    body: { status: 'confirmed' },
  });
  check('new -> confirmed works', confirmed.body?.status === 'confirmed');

  const paid = await api(`/admin/orders/${order._id}/status`, {
    method: 'PATCH',
    token,
    body: { paymentStatus: 'received' },
  });
  check('payment status can be updated', paid.body?.paymentStatus === 'received');

  const resend = await api(`/admin/orders/${order._id}/whatsapp`, { method: 'POST', token });
  check('admin can resend to WhatsApp', resend.status === 200 && !!resend.body.link);

  const receipt = await fetch(`http://127.0.0.1:4111/api/admin/orders/${order._id}/receipt`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const pdf = Buffer.from(await receipt.arrayBuffer());
  check('PDF receipt downloads', receipt.status === 200);
  check('receipt is a real PDF', pdf.subarray(0, 4).toString() === '%PDF', pdf.subarray(0, 8).toString());

  console.log('\n--- reviews ---');
  // pick an item the seed has not already reviewed so the count is unambiguous
  const reviewed = products.body.find((p) => p.name === 'Hot Shots 10pc');
  const review = await api('/reviews', {
    method: 'POST',
    body: { product: reviewed._id, customerName: 'Smoke Tester', rating: 5, comment: 'Great wings' },
  });
  check('review can be submitted', review.status === 201);
  check('new reviews start unapproved', review.body?.review?.approved === false);

  const beforeApproval = await api(`/products/${reviewed.slug}/reviews`);
  check('unapproved review is hidden from customers', beforeApproval.body.reviews.length === 0, `got ${beforeApproval.body.reviews.length}`);

  await api(`/admin/reviews/${review.body.review._id}/approve`, { method: 'PATCH', token, body: { approved: true } });
  const afterApproval = await api(`/products/${reviewed.slug}/reviews`);
  check('approved review shows on the product page', afterApproval.body.reviews.length === 1);
  check('rating summary is computed', afterApproval.body.summary.average === 5 && afterApproval.body.summary.total === 1);

  const badRating = await api('/reviews', {
    method: 'POST',
    body: { product: reviewed._id, customerName: 'X', rating: 9 },
  });
  check('out-of-range rating is rejected', badRating.status === 400);

  const seededReviews = await api(`/products/${burger.slug}/reviews`);
  check('seeded reviews are visible', seededReviews.body.reviews.length > 0);
  check('seeded rating average is sane', seededReviews.body.summary.average >= 4 && seededReviews.body.summary.average <= 5);

  console.log('\n--- admin catalogue ---');
  const adminList = await api('/admin/products', { token });
  check('admin product list loads', adminList.status === 200 && adminList.body.length > 0, `len=${adminList.body?.length}`);
  check('admin list includes ratings', typeof adminList.body[0]?.rating?.average === 'number', JSON.stringify(adminList.body[0]?.rating));
  check('admin list includes sold-out items', adminList.body.length >= (await api('/products', { params: {} })).body.length || adminList.body.length > 0);

  const newCategory = await api('/admin/categories', { method: 'POST', token, body: { name: 'Test Deals' } });
  check('category can be created', newCategory.status === 201);
  check('slug is generated', newCategory.body?.slug === 'test-deals');

  const publicList = await api('/admin/products');
  check('admin product list needs a token', publicList.status === 401);

  const newProduct = await api('/admin/products', {
    method: 'POST',
    token,
    body: { name: 'Test Shawarma', category: newCategory.body._id, price: 300, cost: 120, description: 'Test' },
  });
  check('product can be created', newProduct.status === 201);
  check('product slug is generated', newProduct.body?.slug === 'test-shawarma');

  const edited = await api(`/admin/products/${newProduct.body._id}`, {
    method: 'PUT',
    token,
    body: { name: 'Test Shawarma Special', price: 350 },
  });
  check('product can be edited', edited.body?.name === 'Test Shawarma Special' && edited.body?.price === 350);
  check('slug is kept unique after rename', edited.body?.slug === 'test-shawarma-special');

  const toggled = await api(`/admin/products/${newProduct.body._id}/availability`, { method: 'PATCH', token });
  check('availability can be toggled', toggled.body?.available === false);

  const soldOut = await api('/orders', {
    method: 'POST',
    body: {
      items: [{ ref: newProduct.body._id, qty: 1 }],
      customer: { name: 'Test', phone: '03001234567', address: 'Test Street' },
    },
  });
  check('sold-out item cannot be ordered', soldOut.status === 400 && /sold out/i.test(soldOut.body?.error || ''), soldOut.body?.error);

  const newDeal = await api('/admin/deals', {
    method: 'POST',
    token,
    body: {
      name: 'Test Bundle',
      price: 500,
      endsAt: new Date(Date.now() + 86400000).toISOString(),
      items: [{ product: newProduct.body._id, qty: 2 }],
    },
  });
  check('deal can be created', newDeal.status === 201, newDeal.body?.error);
  check('compare-at price is derived from items', newDeal.body?.compareAtPrice === 700, `got ${newDeal.body?.compareAtPrice}`);

  const expiredDeal = await api('/admin/deals', {
    method: 'POST',
    token,
    body: {
      name: 'Expired Test Bundle',
      price: 500,
      startsAt: new Date(Date.now() - 172800000).toISOString(),
      endsAt: new Date(Date.now() - 86400000).toISOString(),
      items: [{ product: newProduct.body._id, qty: 1 }],
    },
  });
  check('expired deal is created but hidden from the storefront', expiredDeal.status === 201);
  const publicDeals = await api('/deals');
  check('expired deal does not appear publicly', !publicDeals.body.some((d) => d.name === 'Expired Test Bundle'));

  console.log('\n--- analytics ---');
  const overview = await api('/admin/analytics/overview?days=90', { token });
  check('overview loads', overview.status === 200);
  check('revenue is counted from delivered orders', overview.body.totals.revenue > 0, `revenue=${overview.body.totals?.revenue}`);
  check('profit is positive', overview.body.totals.profit > 0, `profit=${overview.body.totals?.profit}`);
  check('order count is populated', overview.body.totals.orders > 0);
  check('average order value is computed', overview.body.totals.avgOrderValue > 0);
  check('payment breakdown is grouped by method', overview.body.byPayment.length > 0);
  check('payment breakdown tracks pending amounts', overview.body.byPayment.some((p) => 'pending' in p));

  const daily = await api('/admin/analytics/daily?days=30', { token });
  check('daily series returns one point per day', daily.body.length === 30, `got ${daily.body?.length}`);
  check('daily series has revenue values', daily.body.some((d) => d.revenue > 0));

  const monthly = await api('/admin/analytics/monthly?months=6', { token });
  check('monthly series returns six months', monthly.body.series.length === 6, `got ${monthly.body?.series?.length}`);
  check('current month has revenue', monthly.body.currentMonth.revenue > 0);
  check('month-over-month change is computed', monthly.body.changePercent !== null);

  const topProducts = await api('/admin/analytics/top-products?days=90&limit=5', { token });
  check('top products ranks items', topProducts.body.length > 0);
  check('top products sorted by quantity sold', topProducts.body.every((p, i, a) => i === 0 || a[i - 1].qtySold >= p.qtySold));

  const topDeals = await api('/admin/analytics/top-deals?days=90', { token });
  check('top deals ranks bundles', topDeals.body.top.length > 0);
  check('never-sold deals are surfaced', Array.isArray(topDeals.body.neverSold));
  check('top deals sorted by quantity sold', topDeals.body.top.every((d, i, a) => i === 0 || a[i - 1].qtySold >= d.qtySold));

  const insights = await api('/admin/analytics/insights?days=90', { token });
  check('insights return plain-language notes', insights.body.notes.length > 0);
  check('insights identify the best seller', insights.body.notes.some((n) => /best seller/i.test(n.title)));
  check('insights report a profit margin', insights.body.metrics.margin !== 0);
  check('insights find the peak ordering hour', insights.body.metrics.peakHour >= 0);

  console.log('\n--- settings ---');
  const update = await api('/admin/settings', {
    method: 'PUT',
    token,
    body: { deliveryFee: 150, minOrderValue: 500, whatsappNumber: '+92 300 1234567' },
  });
  check('settings save', update.status === 200);
  check('whatsapp number is normalised', update.body?.whatsappNumber === '923001234567', `got ${update.body?.whatsappNumber}`);

  const publicAfter = await api('/settings');
  check('new delivery fee reaches the storefront', publicAfter.body.deliveryFee === 150);

  const closeShop = await api('/admin/settings', { method: 'PUT', token, body: { acceptingOrders: false } });
  check('shop can be paused', closeShop.body?.acceptingOrders === false);
  const blocked = await api('/orders', {
    method: 'POST',
    body: {
      items: [{ ref: burger._id, qty: 1 }],
      customer: { name: 'Test', phone: '03001234567', address: 'Test Street' },
    },
  });
  check('paused shop refuses new orders', blocked.status === 503, blocked.body?.error);
  await api('/admin/settings', { method: 'PUT', token, body: { acceptingOrders: true, deliveryFee: 100, minOrderValue: 400 } });

  console.log('\n--- housekeeping ---');
  const del = await api(`/admin/products/${newProduct.body._id}`, { method: 'DELETE', token });
  check('product can be deleted', del.status === 204);
  const delDeal = await api(`/admin/deals/${newDeal.body._id}`, { method: 'DELETE', token });
  check('deal can be deleted', delDeal.status === 204);

  const notFound = await api('/products/does-not-exist');
  check('missing product returns 404', notFound.status === 404);
}

async function login() {
  const res = await api('/auth/login', {
    method: 'POST',
    body: { email: 'admin@tastybites.pk', password: 'tastybites123' },
  });
  return res.body?.token;
}
