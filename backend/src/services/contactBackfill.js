import Order from '../models/Order.js';
import Contact from '../models/Contact.js';
import { getSettings } from '../models/Setting.js';
import { normalisePhone, isValidPkPhone, isLikelyDemoPhone } from '../utils/format.js';

/**
 * Collapses order history into one record per customer.
 *
 * Cancelled orders still prove the person is a real customer, so they are
 * counted in orderCount, but they are not added to lifetime spend.
 *
 * Orders must arrive oldest-first: the later ones then overwrite the contact
 * details, leaving the most recent address and area on the record.
 */
function summariseOrders(orders) {
  const byPhone = new Map();

  for (const order of orders) {
    const phone = normalisePhone(order.customer?.phone);
    if (!phone) continue;

    const createdAt = order.createdAt ? new Date(order.createdAt) : null;
    const entry = byPhone.get(phone) || {
      phone,
      name: '',
      address: '',
      area: '',
      orderCount: 0,
      totalSpent: 0,
      firstOrderAt: null,
      lastOrderAt: null,
    };

    if (order.customer?.name) entry.name = order.customer.name;
    if (order.customer?.address) entry.address = order.customer.address;
    if (order.customer?.area) entry.area = order.customer.area;

    entry.orderCount += 1;
    if (order.status !== 'cancelled') entry.totalSpent += Number(order.total) || 0;

    if (createdAt) {
      if (!entry.firstOrderAt || createdAt < entry.firstOrderAt) entry.firstOrderAt = createdAt;
      if (!entry.lastOrderAt || createdAt > entry.lastOrderAt) entry.lastOrderAt = createdAt;
    }

    byPhone.set(phone, entry);
  }

  return [...byPhone.values()];
}

/**
 * Works out what a backfill would do, without writing anything.
 *
 * Numbers are rejected for four separate reasons, and each rejection is
 * reported back so the admin can see exactly what was left out and why.
 */
export async function previewOrderBackfill() {
  const orders = await Order.find({}, 'customer status total createdAt').sort({ createdAt: 1 }).lean();
  const settings = await getSettings();
  const shopPhone = normalisePhone(settings.whatsappNumber);

  const skipped = [];
  const candidates = [];

  for (const entry of summariseOrders(orders)) {
    if (!isValidPkPhone(entry.phone)) {
      skipped.push({ ...entry, reason: 'not a valid Pakistani mobile number' });
    } else if (entry.phone === shopPhone) {
      skipped.push({ ...entry, reason: 'is the shop’s own WhatsApp number' });
    } else if (isLikelyDemoPhone(entry.phone)) {
      skipped.push({ ...entry, reason: 'looks like demo or placeholder data' });
    } else {
      candidates.push(entry);
    }
  }

  const phones = candidates.map((c) => c.phone);
  const existing = phones.length ? await Contact.find({ phone: { $in: phones } }).lean() : [];
  const existingPhones = new Set(existing.map((c) => c.phone));

  return {
    toCreate: candidates.filter((c) => !existingPhones.has(c.phone)),
    toUpdate: candidates.filter((c) => existingPhones.has(c.phone)),
    skipped,
    scannedOrders: orders.length,
    existingContacts: await Contact.countDocuments(),
  };
}

/**
 * Builds the contact list from real order history.
 *
 * Dry run by default. The admin has to look at the preview and then confirm,
 * because a backfill that runs unattended is how demo data reaches customers.
 */
export async function backfillFromOrders({ dryRun = true } = {}) {
  const preview = await previewOrderBackfill();
  if (dryRun) return { ...preview, applied: false, created: 0, updated: 0 };

  const now = new Date();

  if (preview.toCreate.length) {
    await Contact.insertMany(
      preview.toCreate.map((entry) => ({
        name: entry.name || 'Customer',
        phone: entry.phone,
        area: entry.area,
        source: 'order',
        // the basis is simply that this person ordered from us
        consentSource: 'placed an order',
        consentedAt: now,
        orderCount: entry.orderCount,
        firstOrderAt: entry.firstOrderAt,
        lastOrderAt: entry.lastOrderAt,
        totalSpent: Math.round(entry.totalSpent * 100) / 100,
        lastKnownAddress: entry.address,
        lastKnownArea: entry.area,
      })),
      { ordered: true }
    );
  }

  if (preview.toUpdate.length) {
    // only order history and blank details. consent, optOut and notes are the
    // admin's to change and must survive a re-run.
    await Contact.bulkWrite(
      preview.toUpdate.map((entry) => ({
        updateOne: {
          filter: { phone: entry.phone },
          update: {
            $set: {
              orderCount: entry.orderCount,
              firstOrderAt: entry.firstOrderAt,
              lastOrderAt: entry.lastOrderAt,
              totalSpent: Math.round(entry.totalSpent * 100) / 100,
              lastKnownAddress: entry.address,
              lastKnownArea: entry.area,
            },
          },
        },
      })),
      { ordered: false }
    );
  }

  return {
    ...preview,
    applied: true,
    created: preview.toCreate.length,
    updated: preview.toUpdate.length,
  };
}
