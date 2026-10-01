import Expense from '../models/Expense.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const PAGE_SIZE = 50;

const startOfDay = (value) => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (value) => {
  const d = new Date(value);
  d.setHours(23, 59, 59, 999);
  return d;
};

/** accepts "2026-10-01" and full timestamps; null when the value is missing or broken */
function parseDay(value) {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** total + per-category breakdown for whatever set the admin is currently looking at */
const summarise = (match) =>
  Expense.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$category',
        amount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { amount: -1 } },
  ]);

const amountOnly = async (match) => {
  const [row] = await Expense.aggregate([
    { $match: match },
    { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  return row ? row.amount : 0;
};

export const list = asyncHandler(async (req, res) => {
  const { q, category, from, to } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);

  const query = {};

  if (q) {
    const re = new RegExp(escapeRegExp(q), 'i');
    query.$or = [{ title: re }, { vendor: re }, { notes: re }];
  }

  if (category) query.category = String(category);

  const fromDay = parseDay(from);
  const toDay = parseDay(to);
  if (fromDay || toDay) {
    query.spentAt = {};
    if (fromDay) query.spentAt.$gte = startOfDay(fromDay);
    if (toDay) query.spentAt.$lte = endOfDay(toDay);
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const recentStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));

  const total = await Expense.countDocuments(query);
  const [expenses, byCategory, thisMonth, last30Days, categories] = await Promise.all([
    Expense.find(query)
      .sort({ spentAt: -1, createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    summarise(query),
    amountOnly({ spentAt: { $gte: monthStart } }),
    amountOnly({ spentAt: { $gte: recentStart } }),
    // every heading the shop has ever used, unfiltered, so the filter list
    // does not shrink to the one category currently selected
    Expense.distinct('category'),
  ]);

  res.json({
    expenses,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    categories: categories.filter(Boolean).sort((a, b) => String(a).localeCompare(String(b))),
    summary: {
      count: byCategory.reduce((sum, row) => sum + row.count, 0),
      amount: byCategory.reduce((sum, row) => sum + row.amount, 0),
      byCategory: byCategory.map((row) => ({ category: row._id || 'Other', amount: row.amount, count: row.count })),
      thisMonth,
      last30Days,
    },
  });
});

/**
 * Shared by create and update. Returns either `{ error }` for the admin or
 * `{ fields }` ready to be written, so the two endpoints cannot drift.
 */
function readFields(body, { partial }) {
  const fields = {};

  if (body.title !== undefined || !partial) {
    const title = String(body.title ?? '').trim();
    if (!title) return { error: 'Say what the money was spent on' };
    fields.title = title;
  }

  if (body.amount !== undefined || !partial) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount)) return { error: 'Enter an amount' };
    if (amount <= 0) return { error: 'Amount must be more than zero' };
    fields.amount = amount;
  }

  if (body.spentAt !== undefined || !partial) {
    const day = new Date(body.spentAt ?? Date.now());
    if (Number.isNaN(day.getTime())) return { error: 'That date is not valid' };
    fields.spentAt = day;
  }

  if (body.category !== undefined) {
    fields.category = String(body.category).trim() || 'Other';
  }

  if (body.vendor !== undefined) fields.vendor = String(body.vendor ?? '').trim();
  if (body.notes !== undefined) fields.notes = String(body.notes ?? '');

  return { fields };
}

export const create = asyncHandler(async (req, res) => {
  const { error, fields } = readFields(req.body, { partial: false });
  if (error) return res.status(400).json({ error });

  const expense = await Expense.create({
    ...fields,
    category: fields.category ?? 'Other',
    vendor: fields.vendor ?? '',
    notes: fields.notes ?? '',
  });

  res.status(201).json(expense.toJSON());
});

export const update = asyncHandler(async (req, res) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) return res.status(404).json({ error: 'Expense not found' });

  const { error, fields } = readFields(req.body, { partial: true });
  if (error) return res.status(400).json({ error });

  Object.assign(expense, fields);
  await expense.save();

  res.json(expense.toJSON());
});

export const remove = asyncHandler(async (req, res) => {
  const expense = await Expense.findByIdAndDelete(req.params.id);
  if (!expense) return res.status(404).json({ error: 'Expense not found' });
  res.status(204).end();
});
