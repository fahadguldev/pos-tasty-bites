import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Deal from '../models/Deal.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { startOfDay, endOfDay, toLocalDateString } from '../utils/format.js';

// every status that still counts as a real order
const EARNING_STATUSES = ['new', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'];
const COUNTED = EARNING_STATUSES;

// money only counts once the order is on its way or has arrived
const EARNED_STATUSES = ['out_for_delivery', 'delivered'];

function rangeFromQuery(query) {
  const today = startOfDay(new Date());
  const days = Math.min(365, Math.max(1, parseInt(query.days, 10) || 30));
  return {
    from: startOfDay(new Date(today.getTime() - (days - 1) * 86400000)),
    to: endOfDay(new Date()),
    days,
  };
}

function matchesRange(order, from, to) {
  const d = new Date(order.createdAt);
  return d >= from && d <= to;
}

function lineRevenue(order) {
  return (order.total || 0) - (order.deliveryFee || 0);
}

function lineCost(order) {
  return order.cost || 0;
}

export const overview = asyncHandler(async (req, res) => {
  const { from, to, days } = rangeFromQuery(req.query);
  const orders = await Order.find({ createdAt: { $gte: from, $lte: to } })
    .sort({ createdAt: -1 })
    .lean({ virtuals: true });

  const current = orders.filter((o) => matchesRange(o, from, to) && COUNTED.includes(o.status));
  const revenueOrders = current.filter((o) => EARNED_STATUSES.includes(o.status));
  const cancelled = orders.filter((o) => o.status === 'cancelled');

  const todayStart = startOfDay(new Date());
  const todayOrders = orders.filter(
    (o) => new Date(o.createdAt) >= todayStart && COUNTED.includes(o.status)
  );

  const grossRevenue = revenueOrders.reduce((s, o) => s + (o.total || 0), 0);
  const deliveryCollected = revenueOrders.reduce((s, o) => s + (o.deliveryFee || 0), 0);
  const foodRevenue = revenueOrders.reduce((s, o) => s + lineRevenue(o), 0);
  const cost = revenueOrders.reduce((s, o) => s + lineCost(o), 0);
  const profit = foodRevenue - cost;

  // previous window of the same length, for the trend arrow
  const spanMs = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - spanMs);
  const prevTo = new Date(from.getTime() - 1);
  const prevOrders = await Order.find({ createdAt: { $gte: prevFrom, $lte: prevTo } }).lean();
  const prevRevenueOrders = prevOrders.filter((o) => EARNED_STATUSES.includes(o.status));
  const prevRevenue = prevRevenueOrders.reduce((s, o) => s + (o.total || 0), 0);

  const bySource = {};
  COUNTED.forEach((s) => { bySource[s] = 0; });
  current.forEach((o) => { bySource[o.status] = (bySource[o.status] || 0) + 1; });

  const byPayment = await Order.aggregate([
    { $match: { createdAt: { $gte: from, $lte: to }, status: { $in: COUNTED } } },
    {
      $group: {
        _id: '$paymentMethod',
        orders: { $sum: 1 },
        amount: { $sum: '$total' },
        pending: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'pending'] }, 1, 0] } },
      },
    },
    { $sort: { amount: -1 } },
  ]);

  const newOrders = orders.filter((o) => o.status === 'new');

  res.json({
    range: { from, to, days },
    totals: {
      revenue: Math.round(grossRevenue * 100) / 100,
      foodRevenue: Math.round(foodRevenue * 100) / 100,
      deliveryCollected: Math.round(deliveryCollected * 100) / 100,
      cost: Math.round(cost * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      orders: current.length,
      deliveredOrders: revenueOrders.length,
      cancelledOrders: cancelled.length,
      avgOrderValue: revenueOrders.length ? Math.round((grossRevenue / revenueOrders.length) * 100) / 100 : 0,
      itemsSold: current.reduce((s, o) => s + o.items.reduce((n, i) => n + i.qty, 0), 0),
      avgDeliveryRating: null,
    },
    today: {
      orders: todayOrders.length,
      revenue: Math.round(todayOrders.reduce((s, o) => s + (o.total || 0), 0) * 100) / 100,
    },
    trend: {
      previousRevenue: Math.round(prevRevenue * 100) / 100,
      changePercent: prevRevenue
        ? Math.round(((grossRevenue - prevRevenue) / prevRevenue) * 1000) / 10
        : null,
    },
    byStatus: bySource,
    byPayment,
    newOrdersCount: newOrders.length,
  });
});

export const dailySeries = asyncHandler(async (req, res) => {
  const { from, to, days } = rangeFromQuery(req.query);
  const orders = await Order.find({ createdAt: { $gte: from, $lte: to } }).lean();

  const buckets = new Map();
  for (let i = 0; i < days; i += 1) {
    const day = new Date(from.getTime() + i * 86400000);
    buckets.set(toLocalDateString(day), { date: toLocalDateString(day), revenue: 0, profit: 0, orders: 0, items: 0 });
  }

  orders.forEach((order) => {
    const key = toLocalDateString(order.createdAt);
    const bucket = buckets.get(key);
    if (!bucket) return;
    if (!COUNTED.includes(order.status)) return;

    bucket.orders += 1;
    bucket.items += order.items.reduce((n, i) => n + i.qty, 0);

    if (EARNED_STATUSES.includes(order.status)) {
      bucket.revenue += lineRevenue(order);
      bucket.profit += lineRevenue(order) - lineCost(order);
    }
  });

  const series = [...buckets.values()].map((b) => ({
    date: b.date,
    revenue: Math.round(b.revenue * 100) / 100,
    profit: Math.round(b.profit * 100) / 100,
    orders: b.orders,
    items: b.items,
  }));

  res.json(series);
});

export const monthly = asyncHandler(async (req, res) => {
  const months = Math.min(24, Math.max(1, parseInt(req.query.months, 10) || 6));
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  from.setHours(0, 0, 0, 0);

  const orders = await Order.find({ createdAt: { $gte: from } }).lean();

  const buckets = new Map();
  for (let i = 0; i < months; i += 1) {
    const d = new Date(from.getFullYear(), from.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets.set(key, {
      month: key,
      label: d.toLocaleString('en-US', { month: 'short' }),
      year: d.getFullYear(),
      revenue: 0,
      profit: 0,
      cost: 0,
      orders: 0,
      items: 0,
    });
  }

  orders.forEach((order) => {
    const d = new Date(order.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const bucket = buckets.get(key);
    if (!bucket) return;
    if (order.status === 'cancelled') return;

    bucket.orders += 1;
    bucket.items += order.items.reduce((n, i) => n + i.qty, 0);
    bucket.revenue += lineRevenue(order);
    bucket.cost += lineCost(order);
    bucket.profit += lineRevenue(order) - lineCost(order);
  });

  const series = [...buckets.values()].map((b) => ({
    month: b.month,
    label: b.label,
    year: b.year,
    revenue: Math.round(b.revenue * 100) / 100,
    profit: Math.round(b.profit * 100) / 100,
    cost: Math.round(b.cost * 100) / 100,
    orders: b.orders,
    items: b.items,
  }));

  const current = series[series.length - 1] || null;
  const previous = series[series.length - 2] || null;

  res.json({
    series,
    currentMonth: current,
    previousMonth: previous,
    changePercent:
      previous && previous.revenue
        ? Math.round(((current.revenue - previous.revenue) / previous.revenue) * 1000) / 10
        : null,
  });
});

/** Unwinds order lines so products and deals can be ranked side by side */
async function topItems(kind, { from, to, limit = 10 }) {
  const rows = await Order.aggregate([
    { $match: { createdAt: { $gte: from, $lte: to }, status: { $nin: ['cancelled'] } } },
    { $unwind: '$items' },
    { $match: { 'items.kind': kind } },
    {
      $group: {
        _id: '$items.ref',
        name: { $last: '$items.name' },
        qtySold: { $sum: '$items.qty' },
        revenue: { $sum: '$items.lineTotal' },
        cost: { $sum: { $multiply: ['$items.cost', '$items.qty'] } },
        orderCount: { $sum: 1 },
      },
    },
    { $sort: { qtySold: -1 } },
    { $limit: limit },
  ]);

  return rows.map((row) => ({
    ...row,
    profit: Math.round((row.revenue - row.cost) * 100) / 100,
    avgPerOrder: row.orderCount ? Math.round((row.revenue / row.orderCount) * 100) / 100 : 0,
  }));
}

export const topProducts = asyncHandler(async (req, res) => {
  const { from, to } = rangeFromQuery(req.query);
  const limit = Math.min(30, Math.max(1, parseInt(req.query.limit, 10) || 10));

  const rows = await topItems('product', { from, to, limit });
  res.json(rows);
});

export const topDeals = asyncHandler(async (req, res) => {
  const { from, to } = rangeFromQuery(req.query);
  const limit = Math.min(30, Math.max(1, parseInt(req.query.limit, 10) || 10));

  const [rows, allDeals] = await Promise.all([
    topItems('deal', { from, to, limit }),
    Deal.find({}, 'name image price compareAtPrice startsAt endsAt available').lean({ virtuals: true }),
  ]);

  const now = new Date();
  const dealsById = new Map(allDeals.map((d) => [String(d._id), d]));

  // include deals with zero sales so the admin can see which ones never sell
  const enriched = rows.map((row) => {
    const deal = dealsById.get(String(row._id));
    return {
      ...row,
      image: deal?.image || '',
      price: deal?.price || 0,
      discountPercent: deal?.discountPercent || 0,
      isLive: deal ? deal.available && deal.startsAt <= now && deal.endsAt >= now : false,
    };
  });

  const soldIds = new Set(enriched.map((r) => String(r._id)));
  const neverSold = allDeals
    .filter((d) => !soldIds.has(String(d._id)))
    .map((d) => ({
      _id: d._id,
      name: d.name,
      image: d.image,
      price: d.price,
      qtySold: 0,
      revenue: 0,
      profit: 0,
      orderCount: 0,
      discountPercent: d.discountPercent,
      isLive: d.available && d.startsAt <= now && d.endsAt >= now,
    }));

  res.json({ top: enriched, neverSold });
});

/**
 * Plain-language takeaways. The admin should not have to interpret charts.
 */
export const insights = asyncHandler(async (req, res) => {
  const { from, to, days } = rangeFromQuery(req.query);
  const [orders, topProducts_, topDeals_] = await Promise.all([
    Order.find({ createdAt: { $gte: from, $lte: to } }).lean(),
    topItems('product', { from, to, limit: 5 }),
    topItems('deal', { from, to, limit: 5 }),
  ]);

  const active = orders.filter((o) => o.status !== 'cancelled');
  const revenueOrders = active.filter((o) => EARNED_STATUSES.includes(o.status));

  const revenue = revenueOrders.reduce((s, o) => s + lineRevenue(o), 0);
  const cost = revenueOrders.reduce((s, o) => s + lineCost(o), 0);
  const profit = revenue - cost;
  const margin = revenue ? (profit / revenue) * 100 : 0;

  const cancellationRate = orders.length ? (orders.filter((o) => o.status === 'cancelled').length / orders.length) * 100 : 0;

  // busiest hour across the window
  const hourBuckets = new Array(24).fill(0);
  active.forEach((o) => { hourBuckets[new Date(o.createdAt).getHours()] += 1; });
  const peakHour = hourBuckets.indexOf(Math.max(...hourBuckets));

  // busiest weekday
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayBuckets = new Array(7).fill(0);
  active.forEach((o) => { dayBuckets[new Date(o.createdAt).getDay()] += 1; });
  const peakDay = dayNames[dayBuckets.indexOf(Math.max(...dayBuckets))];

  // repeat customers by phone
  const phoneCounts = new Map();
  active.forEach((o) => {
    const key = o.customer.phone;
    phoneCounts.set(key, (phoneCounts.get(key) || 0) + 1);
  });
  const repeatCustomers = [...phoneCounts.values()].filter((c) => c > 1).length;
  const uniqueCustomers = phoneCounts.size;

  // favourite area
  const areaCounts = new Map();
  active.forEach((o) => {
    const area = (o.customer.area || 'unspecified').trim();
    areaCounts.set(area, (areaCounts.get(area) || 0) + 1);
  });
  const topAreas = [...areaCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  const notes = [];

  if (revenue > 0) {
    notes.push({
      tone: margin >= 35 ? 'good' : margin >= 20 ? 'ok' : 'watch',
      title: `Profit margin is ${margin.toFixed(1)}%`,
      detail: `Rs ${Math.round(profit).toLocaleString()} profit on Rs ${Math.round(revenue).toLocaleString()} food revenue over ${days} days.`,
    });
  }

  if (topProducts_.length) {
    const best = topProducts_[0];
    notes.push({
      tone: 'good',
      title: `${best.name} is your best seller`,
      detail: `${best.qtySold} sold worth Rs ${Math.round(best.revenue).toLocaleString()} — consider featuring it higher.`,
    });
  }

  if (topDeals_.length) {
    const bestDeal = topDeals_[0];
    notes.push({
      tone: 'good',
      title: `Best performing bundle: ${bestDeal.name}`,
      detail: `${bestDeal.qtySold} sold, Rs ${Math.round(bestDeal.revenue).toLocaleString()} revenue.`,
    });
  }

  if (peakHour >= 0 && active.length) {
    notes.push({
      tone: 'ok',
      title: `Peak ordering hour is around ${peakHour}:00`,
      detail: `Put your deals for ${dayNames[new Date(2024, 0, peakHour).getDay()]} — your busiest day is ${peakDay}. Schedule a deal to go live just before peak.`,
    });
  }

  if (cancellationRate > 15) {
    notes.push({
      tone: 'bad',
      title: `${cancellationRate.toFixed(0)}% of orders are cancelled`,
      detail: 'Call the customer before cancelling, and confirm the address before dispatch.',
    });
  }

  if (repeatCustomers > 0) {
    notes.push({
      tone: 'ok',
      title: `${repeatCustomers} of ${uniqueCustomers} customers have ordered more than once`,
      detail: 'Bring the rest back with a review request or a returning-customer deal.',
    });
  }

  if (topAreas.length && topAreas[0][0] !== 'unspecified') {
    notes.push({
      tone: 'ok',
      title: `${topAreas[0][0]} is your busiest area`,
      detail: `${topAreas[0][1]} orders. Run a ${topAreas[0][0]} delivery deal to push volume further.`,
    });
  }

  if (!revenue) {
    notes.push({
      tone: 'watch',
      title: 'No delivered orders in this window yet',
      detail: 'Revenue counts once an order is delivered or out for delivery. Mark orders delivered as you hand them over.',
    });
  }

  res.json({
    range: { from, to, days },
    metrics: {
      revenue: Math.round(revenue * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      margin: Math.round(margin * 10) / 10,
      orders: active.length,
      cancellationRate: Math.round(cancellationRate * 10) / 10,
      peakHour,
      peakDay,
      uniqueCustomers,
      repeatCustomers,
    },
    notes,
  });
});
