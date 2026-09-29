import Review from '../models/Review.js';
import Product from '../models/Product.js';
import Deal from '../models/Deal.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

async function ratingSummary(filter) {
  const rows = await Review.aggregate([
    { $match: filter },
    { $group: { _id: '$rating', count: { $sum: 1 } } },
  ]);

  const buckets = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  let sum = 0;

  rows.forEach(({ _id, count }) => {
    buckets[_id] = count;
    total += count;
    sum += _id * count;
  });

  return {
    average: total ? Math.round((sum / total) * 10) / 10 : 0,
    total,
    buckets,
  };
}

export const forProduct = asyncHandler(async (req, res) => {
  const { slugOrId } = req.params;
  const product = await Product.findOne(
    /^[a-f\d]{24}$/i.test(slugOrId) ? { _id: slugOrId } : { slug: slugOrId }
  ).select('_id');
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const filter = { product: product._id, approved: true };
  const [reviews, summary] = await Promise.all([
    Review.find(filter).sort({ createdAt: -1 }).limit(50).lean(),
    ratingSummary(filter),
  ]);

  res.json({ reviews, summary });
});

export const forDeal = asyncHandler(async (req, res) => {
  const { slugOrId } = req.params;
  const deal = await Deal.findOne(
    /^[a-f\d]{24}$/i.test(slugOrId) ? { _id: slugOrId } : { slug: slugOrId }
  ).select('_id');
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  const filter = { deal: deal._id, approved: true };
  const [reviews, summary] = await Promise.all([
    Review.find(filter).sort({ createdAt: -1 }).limit(50).lean(),
    ratingSummary(filter),
  ]);

  res.json({ reviews, summary });
});

export const create = asyncHandler(async (req, res) => {
  const { product, deal, customerName, rating, comment } = req.body;

  if (!customerName?.trim()) return res.status(400).json({ error: 'Please enter your name' });

  const stars = parseInt(rating, 10);
  if (!stars || stars < 1 || stars > 5) {
    return res.status(400).json({ error: 'Pick a star rating between 1 and 5' });
  }
  if (Boolean(product) === Boolean(deal)) {
    return res.status(400).json({ error: 'A review must point at a product or a deal' });
  }

  if (product) {
    const exists = await Product.findById(product).select('_id');
    if (!exists) return res.status(404).json({ error: 'Product not found' });
  }
  if (deal) {
    const exists = await Deal.findById(deal).select('_id');
    if (!exists) return res.status(404).json({ error: 'Deal not found' });
  }

  const review = await Review.create({
    product: product || null,
    deal: deal || null,
    customerName: String(customerName).trim(),
    rating: stars,
    comment: String(comment || '').trim().slice(0, 1000),
    // held back until the admin approves it
    approved: false,
  });

  res.status(201).json({ review, message: 'Thanks! Your review will appear once approved.' });
});

/** Admin: every review, newest first */
export const listAll = asyncHandler(async (req, res) => {
  const { approved } = req.query;
  const filter = {};
  if (approved === 'true') filter.approved = true;
  if (approved === 'false') filter.approved = false;

  const reviews = await Review.find(filter)
    .populate('product', 'name slug')
    .populate('deal', 'name slug')
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  res.json(reviews);
});

export const setApproved = asyncHandler(async (req, res) => {
  const { approved } = req.body;
  const review = await Review.findByIdAndUpdate(
    req.params.id,
    { approved: Boolean(approved) },
    { new: true }
  );
  if (!review) return res.status(404).json({ error: 'Review not found' });
  res.json(review);
});

export const remove = asyncHandler(async (req, res) => {
  const review = await Review.findByIdAndDelete(req.params.id);
  if (!review) return res.status(404).json({ error: 'Review not found' });
  res.status(204).end();
});
