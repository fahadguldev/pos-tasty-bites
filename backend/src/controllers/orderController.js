import Order from '../models/Order.js';
import { nextSequence } from '../models/Counter.js';
import { getSettings } from '../models/Setting.js';
import { priceCart } from '../services/pricing.js';
import { notifyNewOrder, buildOrderMessage, buildWaLink } from '../services/whatsapp.js';
import { streamOrderReceipt } from '../services/receipt.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { isValidPkPhone, normalisePhone } from '../utils/format.js';

async function buildOrderNo() {
  const seq = await nextSequence('order');
  return `TB-${String(seq).padStart(4, '0')}`;
}

function validateCustomer(customer = {}) {
  const { name, phone, address } = customer;

  if (!name?.trim()) return 'Please enter your name';
  if (!address?.trim()) return 'Please enter your delivery address';
  if (!phone?.trim()) return 'Please enter your phone number';
  if (!isValidPkPhone(phone)) return 'Enter a valid phone number, e.g. 03001234567';

  return null;
}

function cleanCustomer(customer = {}) {
  return {
    name: String(customer.name).trim(),
    phone: normalisePhone(customer.phone),
    address: String(customer.address).trim(),
    area: String(customer.area || '').trim(),
    landmark: String(customer.landmark || '').trim(),
    notes: String(customer.notes || '').trim().slice(0, 500),
  };
}

async function isPaymentMethodEnabled(code, settings) {
  if (!code) return true;
  const method = (settings.paymentMethods || []).find((m) => m.code === code);
  return method ? method.active : true;
}

/**
 * POST /api/orders/quote — price a cart without creating an order.
 * The storefront calls this as the customer edits their cart so the delivery fee
 * and the "add X more to reach the minimum" hint always come from the server.
 */
export const quote = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  // skip the minimum-order rejection here: the drawer needs to show the gap
  const priced = await priceCart(req.body.items, settings, { checkMinimum: false });

  res.json({
    items: priced.items,
    subtotal: priced.subtotal,
    discount: priced.discount,
    deliveryFee: priced.deliveryFee,
    total: priced.total,
    minOrderValue: settings.minOrderValue || 0,
    freeDeliveryAbove: settings.freeDeliveryAbove || 0,
  });
});

/** POST /api/orders — customer places a website order */
export const create = asyncHandler(async (req, res) => {
  const { items, customer, paymentMethod = 'cod', source = 'website' } = req.body;

  const invalid = validateCustomer(customer);
  if (invalid) return res.status(400).json({ error: invalid });

  const settings = await getSettings();
  if (!settings.acceptingOrders) {
    return res.status(503).json({ error: 'We are not accepting orders right now. Please try again shortly.' });
  }
  if (!(await isPaymentMethodEnabled(paymentMethod, settings))) {
    return res.status(400).json({ error: 'That payment method is not available' });
  }

  const priced = await priceCart(items, settings);

  const order = await Order.create({
    orderNo: await buildOrderNo(),
    items: priced.items,
    customer: cleanCustomer(customer),
    paymentMethod,
    // cash on delivery is collected by the rider, everything else starts pending
    paymentStatus: paymentMethod === 'cod' ? 'pending' : 'pending',
    source,
    subtotal: priced.subtotal,
    discount: priced.discount,
    deliveryFee: priced.deliveryFee,
    total: priced.total,
    cost: priced.cost,
  });

  const notification = await notifyNewOrder(order);

  order.whatsappNotified = notification.sent;
  order.whatsappError = notification.sent ? '' : notification.error;
  await order.save();

  res.status(201).json({
    order,
    whatsapp: {
      sent: notification.sent,
      channel: notification.channel,
      link: notification.link,
      note: notification.error,
    },
  });
});

/** POST /api/orders/whatsapp-link — same order flow, but hands back a wa.me link */
export const createWhatsappLink = asyncHandler(async (req, res) => {
  const { items, customer, paymentMethod = 'cod' } = req.body;

  const invalid = validateCustomer(customer);
  if (invalid) return res.status(400).json({ error: invalid });

  const settings = await getSettings();
  const priced = await priceCart(items, settings);

  const order = await Order.create({
    orderNo: await buildOrderNo(),
    items: priced.items,
    customer: cleanCustomer(customer),
    paymentMethod,
    paymentStatus: 'pending',
    source: 'whatsapp',
    subtotal: priced.subtotal,
    discount: priced.discount,
    deliveryFee: priced.deliveryFee,
    total: priced.total,
    cost: priced.cost,
  });

  const message = buildOrderMessage(order, settings);

  res.status(201).json({
    order,
    whatsapp: {
      sent: false,
      channel: 'wa_link',
      link: buildWaLink(settings.whatsappNumber, message),
      message,
      note: 'Tap send to place this order on WhatsApp — it is already saved in the dashboard.',
    },
  });
});

/** Public status lookup by order number + phone, so a customer can track without an account */
export const track = asyncHandler(async (req, res) => {
  const { orderNo, phone } = req.query;

  if (!orderNo || !phone) {
    return res.status(400).json({ error: 'Enter your order number and phone number' });
  }

  const order = await Order.findOne({
    orderNo: String(orderNo).trim().toUpperCase(),
    'customer.phone': normalisePhone(phone),
  }).lean({ virtuals: true });

  if (!order) return res.status(404).json({ error: 'No order found with those details' });

  const settings = await getSettings();

  res.json({
    orderNo: order.orderNo,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    total: order.total,
    placedAt: order.createdAt,
    deliveredAt: order.deliveredAt,
    items: order.items,
    shopName: settings.shopName,
    phone: settings.phone,
  });
});

/** Admin: order list with filters and pagination */
export const list = asyncHandler(async (req, res) => {
  const { status, paymentMethod, paymentStatus, source, from, to, search, page = 1, limit = 50 } = req.query;
  const filter = {};

  if (status && status !== 'all') {
    filter.status = status === 'active' ? { $nin: ['delivered', 'cancelled'] } : status;
  }
  if (paymentMethod && paymentMethod !== 'all') filter.paymentMethod = paymentMethod;
  if (paymentStatus && paymentStatus !== 'all') filter.paymentStatus = paymentStatus;
  if (source && source !== 'all') filter.source = source;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }
  if (search) {
    const rx = { $regex: String(search).trim(), $options: 'i' };
    filter.$or = [{ orderNo: rx }, { 'customer.name': rx }, { 'customer.phone': rx }];
  }

  const take = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const current = Math.max(1, parseInt(page, 10) || 1);

  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((current - 1) * take).limit(take).lean({ virtuals: true }),
    Order.countDocuments(filter),
  ]);

  res.json({ orders, total, page: current, pages: Math.ceil(total / take) });
});

export const getOne = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).lean({ virtuals: true });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

const ALLOWED_TRANSITIONS = {
  new: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export const updateStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, paymentStatus, cancelledReason } = req.body;

  const order = await Order.findById(id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (status && status !== order.status) {
    const allowed = ALLOWED_TRANSITIONS[order.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: `Cannot move an order from "${order.status}" to "${status}"`,
        allowed,
      });
    }
    order.status = status;
    if (status === 'delivered') order.deliveredAt = new Date();
    if (status === 'cancelled') order.cancelledReason = cancelledReason || '';
  }

  if (paymentStatus) order.paymentStatus = paymentStatus;

  await order.save();
  res.json(order);
});

/** Re-send the order to WhatsApp — returns a tap-to-send link either way */
export const resendWhatsapp = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const notification = await notifyNewOrder(order);
  order.whatsappNotified = notification.sent;
  order.whatsappError = notification.sent ? '' : notification.error;
  await order.save();

  res.json({
    sent: notification.sent,
    channel: notification.channel,
    link: notification.link,
    note: notification.error,
  });
});

export const receipt = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const settings = await getSettings();
  streamOrderReceipt(order, settings, res);
});
