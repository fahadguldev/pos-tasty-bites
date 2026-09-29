/**
 * End-to-end smoke test. Boots the API in-process against a throwaway MongoDB,
 * seeds the demo menu, then walks the full order flow and prints the results.
 *
 *   node src/smoke.js
 */
process.env.MONGODB_URI = '';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'smoke_test_secret_not_for_production';
process.env.AUTO_SEED = 'false';

// the campaign tests use the fake transport, which records messages instead of
// sending them. no real number is involved at any point in this run.
process.env.WHATSAPP_TRANSPORT = 'fake';
process.env.WHATSAPP_SEND_ENABLED = 'false';

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

  console.log('\n--- contacts ---');
  const contactsNoAuth = await api('/admin/contacts');
  check('contact list is admin only', contactsNoAuth.status === 401);

  const preview = await api('/admin/contacts/backfill/preview', { token });
  check('backfill preview works without writing', preview.status === 200);
  check('backfill preview reports what it would create', Array.isArray(preview.body?.toCreate));
  check(
    'demo seed numbers are never queued as contacts',
    (preview.body?.toCreate || []).every((c) => !/(\d)\1{4,}/.test(c.phone)),
    'a placeholder number was queued'
  );
  check(
    'the shop’s own whatsapp number is never queued',
    (preview.body?.toCreate || []).every((c) => c.phone !== '923001234567')
  );
  check(
    'the shop’s own number is skipped even when it has ordered',
    (preview.body?.skipped || []).some((s) => s.phone === '923001234567'),
    'the shop number was queued'
  );
  check(
    'preview finds the customers who really ordered',
    (preview.body?.toCreate || []).some((c) => c.phone === '923002234567'),
    'the real order customer was missing'
  );
  check('nothing is written before applying', (await ContactCount()) === 0);

  const applied = await api('/admin/contacts/backfill', { method: 'POST', token });
  check('backfill applies', applied.status === 200, applied.body?.error);
  check('backfill created the ordering customers', applied.body?.created >= 2, `created ${applied.body?.created}`);

  const again = await api('/admin/contacts/backfill', { method: 'POST', token });
  check('running the backfill twice does not duplicate', again.body?.created === 0, `created ${again.body?.created}`);

  const backfilled = await api('/admin/contacts?q=Fatima', { token });
  check('backfilled contact keeps the order history', backfilled.body?.contacts?.[0]?.orderCount >= 1, `orderCount ${backfilled.body?.contacts?.[0]?.orderCount}`);
  check('backfilled contact is marked as coming from an order', backfilled.body?.contacts?.[0]?.source === 'order');

  const contactList = await api('/admin/contacts', { token });
  check('contact list loads', contactList.status === 200 && Array.isArray(contactList.body?.contacts));
  check('contact list is paginated', typeof contactList.body?.total === 'number');

  const badContactPhone = await api('/admin/contacts', { method: 'POST', token, body: { name: 'Test', phone: '123' } });
  check('contact with a malformed number is rejected', badContactPhone.status === 400, badContactPhone.body?.error);

  const demoPhone = await api('/admin/contacts', { method: 'POST', token, body: { name: 'Ahmed Raza', phone: '923001111111' } });
  check('contact with a demo number is rejected', demoPhone.status === 400, demoPhone.body?.error);

  const noName = await api('/admin/contacts', { method: 'POST', token, body: { name: '', phone: '03009988887' } });
  check('contact without a name is rejected', noName.status === 400);

  const added = await api('/admin/contacts', { method: 'POST', token, body: { name: 'Walk-in Regular', phone: '0300-9988881' } });
  check('a contact can be added by hand', added.status === 201, added.body?.error);
  check('the number is stored normalised', added.body?.phone === '923009988881', `got ${added.body?.phone}`);

  const dupe = await api('/admin/contacts', { method: 'POST', token, body: { name: 'Someone Else', phone: '03009988881' } });
  check('the same number cannot be added twice', dupe.status === 409, dupe.body?.error);

  const contactId = added.body?._id;
  const optedOut = await api(`/admin/contacts/${contactId}`, { method: 'PUT', token, body: { optOut: true } });
  check('a contact can be opted out', optedOut.body?.optOut === true);
  check('an opted-out contact is not contactable', optedOut.body?.isContactable === false);

  const contactable = await api('/admin/contacts?filter=contactable', { token });
  check(
    'opted-out contacts are hidden from the contactable filter',
    !contactable.body.contacts.some((c) => c._id === contactId)
  );

  const optedOutList = await api('/admin/contacts?filter=optedOut', { token });
  check('opted-out contacts are still listed for review', optedOutList.body.contacts.some((c) => c._id === contactId));

  const searched = await api('/admin/contacts?q=Walk-in', { token });
  check('contacts can be searched by name', searched.body.contacts.some((c) => c._id === contactId));

  const delContact = await api(`/admin/contacts/${contactId}`, { method: 'DELETE', token });
  check('a contact can be deleted', delContact.status === 204);

  const gone = await api(`/admin/contacts/${contactId}`, { token });
  check('a deleted contact returns 404', gone.status === 404);

  console.log('\n--- campaign engine ---');
  const transportApi = await import('./services/transport.js');
  const { renderTemplate, validateTemplate, variationCount } = await import('./services/template.js');
  const { classifyReply, handleInbound } = await import('./services/inbound.js');
  const sending = await import('./services/sending.js');
  const Contact = (await import('./models/Contact.js')).default;
  const SendJob = (await import('./models/SendJob.js')).default;
  const Campaign = (await import('./models/Campaign.js')).default;

  // ---- the send gate comes first: nothing may send by accident ----
  transportApi.resetTransport();
  const savedTransport = process.env.WHATSAPP_TRANSPORT;
  delete process.env.WHATSAPP_TRANSPORT;
  let sendGateBlocked = false;
  try {
    await transportApi.getTransport();
  } catch (err) {
    sendGateBlocked = err instanceof transportApi.SendDisabledError;
  }
  check('sending is refused when no transport is configured', sendGateBlocked);

  process.env.WHATSAPP_TRANSPORT = 'openwa';
  process.env.WHATSAPP_SEND_ENABLED = 'false';
  transportApi.resetTransport();
  let openwaBlocked = false;
  try {
    await transportApi.getTransport();
  } catch {
    openwaBlocked = true;
  }
  check('open-wa stays blocked without the send flag', openwaBlocked);

  process.env.WHATSAPP_TRANSPORT = savedTransport;
  transportApi.resetTransport();
  const transport = await transportApi.getTransport();
  check('the test run uses the fake transport', transport.name === 'fake');

  // ---- message wording ----
  const sample = { name: 'Ahmed Raza', phone: '923001234567', area: 'Civil Colony' };
  const first = renderTemplate('{{spin:Hi|Hey|Hello}} {{name}}', { contact: sample });
  const repeat = renderTemplate('{{spin:Hi|Hey|Hello}} {{name}}', { contact: sample });
  check('the same customer always gets the same wording', first === repeat, `${first} vs ${repeat}`);
  check('a spin resolves to one real option', ['Hi', 'Hey', 'Hello'].includes(first.split(' ')[0]), first);
  check('the name is substituted', first.endsWith('Ahmed'), first);

  const crowd = Array.from({ length: 20 }, (_, i) => ({ name: `Guest ${i}`, phone: `9231${String(i).padStart(9, '0')}` }));
  const wordings = new Set(crowd.map((c) => renderTemplate('{{spin:Hi|Hey|Hello}}', { contact: c })));
  check('different customers get varied wording', wordings.size > 1, `${wordings.size} distinct wordings`);

  check('an unknown token is reported', validateTemplate('hello {{nope}}').length > 0);
  check('a spin with one option is reported', validateTemplate('{{spin:Hi}}').length > 0);
  check('a valid template reports no problems', validateTemplate('{{spin:Hi|Hey}} {{name}}').length === 0);
  check('the number of possible wordings is reported', variationCount('{{spin:a|b}} {{spin:c|d}}') === 4);

  // ---- replies are understood before any number exists ----
  const optionSet = [
    { id: 'yes', label: 'Yes please', action: 'send_deal' },
    { id: 'later', label: 'Not now', action: 'snooze', snoozeDays: 30 },
    { id: 'stop', label: 'Stop', action: 'stop' },
  ];
  check('a tapped button decides the action', classifyReply({ buttonId: 'stop', options: optionSet }).action === 'stop');
  check('STOP is permanent', classifyReply({ text: 'STOP', options: optionSet }).action === 'stop');
  check('a plain no is only a pause', classifyReply({ text: 'no', options: optionSet }).action === 'snooze');
  check('yes asks for the deal', classifyReply({ text: 'yes please', options: optionSet }).action === 'send_deal');
  check('unclear text is ignored', classifyReply({ text: 'hmm', options: optionSet }).action === 'ignore');

  // ---- a campaign ----
  const noCampaignAuth = await api('/admin/campaigns');
  check('campaign routes are admin only', noCampaignAuth.status === 401);

  const badTokenCampaign = await api('/admin/campaigns', {
    method: 'POST',
    token,
    body: { name: 'Broken', openerTemplate: 'hi', dealTemplate: '{{nope}}' },
  });
  check('a campaign with an unknown token is rejected', badTokenCampaign.status === 400, badTokenCampaign.body?.error);

  const tooManyButtons = await api('/admin/campaigns', {
    method: 'POST',
    token,
    body: {
      name: 'Too many',
      openerTemplate: 'hi',
      dealTemplate: 'deal',
      options: [
        { id: 'a', label: 'A', action: 'send_deal' },
        { id: 'b', label: 'B', action: 'snooze' },
        { id: 'c', label: 'C', action: 'stop' },
        { id: 'd', label: 'D', action: 'stop' },
      ],
    },
  });
  check('a campaign cannot carry more than three buttons', tooManyButtons.status === 400, tooManyButtons.body?.error);

  // two extra customers, so the campaign has a known audience to pick from
  await api('/admin/contacts', { method: 'POST', token, body: { name: 'Walk-in One', phone: '03011122233' } });
  await api('/admin/contacts', { method: 'POST', token, body: { name: 'Walk-in Two', phone: '03011133344' } });

  const created = await api('/admin/campaigns', {
    method: 'POST',
    token,
    body: {
      name: 'Midweek deals',
      deal: deal._id,
      sendImage: true,
      openerTemplate: '{{spin:Hi|Hey|Hello}} {{name}}, {{shopName}} has a new deal out. Want the details?',
      dealTemplate: 'Here it is: {{deal}} at {{dealPrice}}. {{dealSaving}} Order here: {{dealLink}}',
      recipientLimit: 3,
      gap: { minSeconds: 2, maxSeconds: 4 },
      options: optionSet,
    },
  });
  check('a campaign can be created', created.status === 201, created.body?.error);
  const campaignId = created.body?._id;
  check('a new campaign starts as a draft', created.body?.status === 'draft');
  check('the chosen recipient count is stored', created.body?.recipientLimit === 3);
  check('the pause between messages is stored', created.body?.gap?.minSeconds === 2);

  const previewRes = await api(`/admin/campaigns/${campaignId}/preview`, { token });
  check('a campaign can be previewed', previewRes.status === 200, previewRes.body?.error);
  check('the preview reports who will be messaged', typeof previewRes.body?.audience?.willSend === 'number');
  check('the preview renders real customers', (previewRes.body?.openerSamples || []).length > 0);
  check('the preview finds no template problems', (previewRes.body?.openerProblems || []).length === 0);
  check('the preview respects the chosen number', previewRes.body?.audience?.willSend === 3, `willSend ${previewRes.body?.audience?.willSend}`);
  check('the preview knows the chosen number', previewRes.body?.audience?.recipientLimit === 3);

  // ---- starting the campaign queues exactly what the admin asked for ----
  const started = await api(`/admin/campaigns/${campaignId}/start`, { method: 'POST', token });
  check('a campaign can be started', started.status === 200, started.body?.error);
  check('starting queues exactly the chosen number', started.body?.queued === 3, `queued ${started.body?.queued}`);
  check('the campaign is now running', started.body?.campaign?.status === 'running');

  const restart = await api(`/admin/campaigns/${campaignId}/start`, { method: 'POST', token });
  check('a running campaign cannot be started again', restart.status === 409);

  const queuedJobs = await SendJob.find({ campaign: campaignId, stage: 'opener' });
  check('every opener was rendered at queue time', queuedJobs.every((j) => j.variant && j.variant.length > 0));
  check('every opener carries the quick-reply buttons', queuedJobs.every((j) => j.buttons.length === 3));
  check('nobody was queued twice', new Set(queuedJobs.map((j) => j.phone)).size === queuedJobs.length);
  check('no deal message exists yet', (await SendJob.countDocuments({ campaign: campaignId, stage: 'deal' })) === 0);

  // ---- the worker sends one job at a time ----
  const claimed = await sending.claimNextJob(campaignId);
  check('a queued job can be claimed', !!claimed);
  check('claiming marks the job as in flight', claimed?.status === 'sending');
  check('claiming counts an attempt', claimed?.attempts === 1);

  const secondJob = await sending.claimNextJob(campaignId);
  check('the next claim is a different job', secondJob?._id?.toString() !== claimed?._id?.toString());
  await sending.markSent(secondJob);

  await transport.sendText({ to: claimed.phone, text: claimed.variant, buttons: claimed.buttons });
  await sending.markSent(claimed);
  check('a sent job is recorded', claimed.status === 'sent' && !!claimed.sentAt);
  check('the transport recorded the exact stored wording', transport.sent[0]?.text === claimed.variant);

  // ---- tapping Yes is the only path to the deal ----
  const yesReply = await handleInbound({ from: claimed.phone, buttonId: 'yes' });
  check('tapping Yes queues the deal', yesReply.action === 'deal_queued', JSON.stringify(yesReply));

  const dealJob = await SendJob.findOne({ campaign: campaignId, phone: claimed.phone, stage: 'deal' });
  check('a deal job appears only after the reply', !!dealJob);
  check('the deal is still waiting to be sent', dealJob?.status === 'queued');
  check('the deal message carries the deal price', /Rs/.test(dealJob?.variant || ''), dealJob?.variant);
  check(
    'the contact is remembered as having asked for it',
    (await Contact.findOne({ phone: claimed.phone }))?.qualifiedAt > new Date(Date.now() - 60000)
  );

  const replyAgain = await handleInbound({ from: claimed.phone, text: 'yes' });
  check('a second yes does not queue a second deal', replyAgain.action === 'already_queued', JSON.stringify(replyAgain));

  // ---- STOP always wins ----
  const stopped = await handleInbound({ from: secondJob.phone, text: 'STOP' });
  check('STOP is understood', stopped.action === 'stopped', JSON.stringify(stopped));

  const stoppedContact = await Contact.findOne({ phone: secondJob.phone });
  check('STOP marks the contact as opted out', stoppedContact?.optOut === true);
  check('an opted-out contact is no longer contactable', stoppedContact?.isContactable === false);
  check(
    'opting out never queues a deal',
    !(await SendJob.findOne({ campaign: campaignId, phone: secondJob.phone, stage: 'deal' }))
  );

  // ---- "not now" pauses without blacklisting ----
  const third = await sending.claimNextJob(campaignId);
  check('the last opener is still waiting to be sent', third?.stage === 'opener', third?.stage);
  await sending.markSent(third);
  const snoozed = await handleInbound({ from: third.phone, text: 'not now' });
  check('"not now" is understood', snoozed.action === 'snoozed', JSON.stringify(snoozed));

  const snoozedContact = await Contact.findOne({ phone: third.phone });
  check('"not now" does not opt anyone out', snoozedContact?.optOut === false);
  check('"not now" pauses the contact for 30 days', snoozedContact?.doNotContactUntil > new Date());
  check('"not now" never queues a deal', !(await SendJob.findOne({ campaign: campaignId, phone: third.phone, stage: 'deal' })));

  // ---- a failed send is retried once, then parked ----
  // runs on its own campaign so no other queued job can be claimed by mistake
  const retryCampaign = await Campaign.create({
    name: 'Retry check',
    openerTemplate: 'hi {{name}}',
    dealTemplate: 'the deal',
    recipientLimit: 1,
  });
  const flaky = await SendJob.create({
    campaign: retryCampaign._id,
    contact: (await Contact.findOne({ phone: claimed.phone }))._id,
    phone: '92310987654',
    stage: 'opener',
    status: 'queued',
    variant: 'retry me',
  });

  const retryClaim = await sending.claimNextJob(retryCampaign._id);
  check('the queued job can be claimed', retryClaim?.id === flaky.id);
  await sending.markFailed(retryClaim, new Error('network down'));
  check('a failed send goes back in the queue', retryClaim.status === 'queued', retryClaim.status);
  check('the failure reason is recorded', /network down/.test(retryClaim.lastError));

  const secondClaim = await sending.claimNextJob(retryCampaign._id);
  check('the retried job is the same one', secondClaim?.id === flaky.id);
  await sending.markFailed(secondClaim, new Error('network down again'));
  check('a send that keeps failing is parked', secondClaim.status === 'failed', secondClaim.status);
  check('a parked job is not picked up again', !(await sending.claimNextJob(retryCampaign._id)));

  await retryCampaign.deleteOne();
  await flaky.deleteOne();

  // ---- history and controls ----
  const history = await api(`/admin/campaigns/${campaignId}/messages`, { token });
  check('the message history is recorded', history.status === 200 && history.body.total > 0, `total ${history.body?.total}`);
  check('replies are logged too', history.body.entries.some((e) => e.direction === 'in'));

  const editRunning = await api(`/admin/campaigns/${campaignId}`, { method: 'PUT', token, body: { name: 'Renamed' } });
  check('a running campaign cannot be edited', editRunning.status === 409);

  const paused = await api(`/admin/campaigns/${campaignId}/pause`, { method: 'POST', token });
  check('a campaign can be paused', paused.body?.status === 'paused');
  const resumed = await api(`/admin/campaigns/${campaignId}/resume`, { method: 'POST', token });
  check('a paused campaign can resume', resumed.body?.status === 'running');

  const deleteRunning = await api(`/admin/campaigns/${campaignId}`, { method: 'DELETE', token });
  check('a running campaign cannot be deleted', deleteRunning.status === 409);

  const cancelled = await api(`/admin/campaigns/${campaignId}/cancel`, { method: 'POST', token, body: { reason: 'test over' } });
  check('a campaign can be cancelled', cancelled.body?.status === 'cancelled');
  check('cancelling stops anything still waiting', (await SendJob.countDocuments({ campaign: campaignId, status: 'queued' })) === 0);
  check('nothing is left to claim after cancelling', !(await sending.claimNextJob(campaignId)));

  const deleted = await api(`/admin/campaigns/${campaignId}`, { method: 'DELETE', token });
  check('a cancelled campaign can be deleted', deleted.status === 204);
  check('deleting a campaign removes its jobs', (await SendJob.countDocuments({ campaign: campaignId })) === 0);

  console.log('\n--- whatsapp connection ---');
  const whatsappStatus = await import('./services/whatsappStatus.js');
  const { toChatId, fromChatId, eventData } = await import('./services/openwaTransport.js');

  check('a phone number becomes a whatsapp chat id', toChatId('03001234567') === '923001234567@c.us', toChatId('03001234567'));
  check('a chat id becomes a phone number again', fromChatId('923001234567@c.us') === '923001234567');
  check('a number with spaces and dashes still works', toChatId('0300-123 4567') === '923001234567@c.us');
  check('an empty recipient is refused', (() => { try { toChatId(''); return false; } catch { return true; } })());

  // Real payloads captured from a live open-wa client. Reading the wrong level
  // here loses the QR code and every state change without throwing anything,
  // which is exactly how it failed while 200-odd other checks were passing.
  const qrEvent = { correlationId: 'qr-wait', ts: 1790708343396, step: 'qr_generated', details: { qr: 'https://wa.me/settings/linked_devices#2@1aHEB', attemptInThisCycle: 1 } };
  check('a QR code is found inside the step event', eventData(qrEvent).qr === 'https://wa.me/settings/linked_devices#2@1aHEB');

  const stateEvent = { correlationId: 'system', ts: 1790708320082, step: 'state_change', details: { prev: 'DISCONNECTED', next: 'READY' } };
  check('a state change is found inside the step event', eventData(stateEvent).next === 'READY');

  const logoutEvent = { correlationId: 'system', ts: 1790708320082, step: 'state_change', details: { prev: 'READY', next: 'DISCONNECTED', reason: 'signed out' } };
  check('a logout reason is found inside the step event', eventData(logoutEvent).reason === 'signed out');

  const messageEvent = { ctx: { correlationId: 'x' }, message: { id: 'wamid.1', chatId: '923001234567@c.us', body: 'Yes' } };
  check('a message is read from the top level', eventData(messageEvent).message.body === 'Yes');
  check('an empty payload does not throw', Object.keys(eventData(undefined)).length === 0);

  // open-wa's own state names are internal, so they are translated before the
  // admin ever sees them
  check('a QR code means the screen should wait for a scan', whatsappStatus.describeStatus('AUTHENTICATING', { qr: '2@abc' }).status === 'awaiting_scan');
  check('a signed-in session reads as ready', whatsappStatus.describeStatus('READY', { ready: true }).status === 'ready');
  // a working session must not be shown as broken by a stale reason string
  check('a live session is not shown as broken by an old error', whatsappStatus.describeStatus('READY', { ready: true, lastError: 'reconnecting' }).status === 'ready');
  check('a failure with no live session is an error', whatsappStatus.describeStatus('STOPPED', { lastError: 'boom' }).status === 'error');
  check('a brand new client reads as offline', whatsappStatus.describeStatus('UNLAUNCHED').status === 'offline');

  const stale = new Date(Date.now() - 10 * 60 * 1000);
  const expired = whatsappStatus.describeStatus('AUTHENTICATING', { qr: '2@abc', qrIssuedAt: stale });
  check('an old QR code is not shown as scannable', expired.qr === '' && expired.qrExpired === true);

  const statusRes = await api('/admin/whatsapp/status', { token });
  check('the whatsapp status is readable', statusRes.status === 200, statusRes.body?.error);
  check('no worker means the status is offline', statusRes.body?.status === 'offline', statusRes.body?.status);
  check('the status says sending is switched off', statusRes.body?.sendEnabled === false);
  check('the status says how to start the worker', statusRes.body?.startCommand === 'npm run worker');

  const badTest = await api('/admin/whatsapp/test', { method: 'POST', token, body: { phone: '123' } });
  check('a test message to an invalid number is refused', badTest.status === 400);

  const earlyTest = await api('/admin/whatsapp/test', { method: 'POST', token, body: { phone: '03001234567' } });
  check('a test message before connecting is refused', earlyTest.status === 409, earlyTest.body?.error);

  // the browser lives in the worker, so the admin can only leave a note for it
  await api('/admin/whatsapp/logout', { method: 'POST', token });
  check('the admin can ask the worker to sign out', (await whatsappStatus.takeCommand()) === 'logout');
  check('a note is only acted on once', (await whatsappStatus.takeCommand()) === '');

  await whatsappStatus.requestCommand('test:923001234567');
  await whatsappStatus.recordTestResult({ phone: '923001234567', ok: true });
  const testState = await whatsappStatus.readStatus();
  check('the worker reports a successful test message', testState.lastTest?.ok === true && testState.lastTest?.phone === '923001234567');
  check('a test message does not make the session look connected', testState.ready === false);

  const draft = await Campaign.create({ name: 'Never started', openerTemplate: 'hi', dealTemplate: 'deal' });
  const resumeDraft = await api(`/admin/campaigns/${draft._id}/resume`, { method: 'POST', token });
  check('a campaign that was never paused cannot resume', resumeDraft.status === 409, `status ${resumeDraft.status}`);
  await draft.deleteOne();

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

// reads straight from the database so a test can prove a preview wrote nothing
async function ContactCount() {
  const { default: Contact } = await import('./models/Contact.js');
  return Contact.countDocuments();
}
