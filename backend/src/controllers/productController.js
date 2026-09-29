import Product from '../models/Product.js';
import Review from '../models/Review.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { uniqueSlug } from './categoryController.js';

function parseVariants(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v) => v && v.name && v.price !== undefined && v.price !== '')
    .map((v) => ({
      name: String(v.name).trim(),
      price: Math.max(0, Number(v.price) || 0),
      active: v.active !== false,
    }));
}

function parseImages(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((img) => img && (img.url || typeof img === 'string'))
    .map((img) => (typeof img === 'string' ? { url: img, publicId: '' } : { url: img.url, publicId: img.publicId || '' }));
}

export const list = asyncHandler(async (req, res) => {
  const { category, search, featured, includeUnavailable, withRating } = req.query;
  return sendProducts(res, { category, search, featured, includeUnavailable, withRating });
});

/** Admin list: sold-out items included and every item carries its rating. */
export const adminList = asyncHandler(async (req, res) => {
  return sendProducts(res, {
    category: req.query.category,
    search: req.query.search,
    includeUnavailable: 'true',
    withRating: 'true',
  });
});

async function sendProducts(res, { category, search, featured, includeUnavailable, withRating }) {
  const filter = {};

  if (!includeUnavailable) filter.available = true;
  if (category && category !== 'all') filter.category = category;
  if (featured === 'true') filter.featured = true;
  if (search) filter.name = { $regex: String(search).trim(), $options: 'i' };

  const products = await Product.find(filter)
    .populate('category', 'name slug')
    .sort({ sortOrder: 1, name: 1 })
    .lean({ virtuals: true });

  if (withRating === 'true') {
    const ids = products.map((p) => p._id);
    const rows = ids.length
      ? await Review.aggregate([
          { $match: { product: { $in: ids }, approved: true } },
          { $group: { _id: '$product', average: { $avg: '$rating' }, total: { $sum: 1 } } },
        ])
      : [];
    const byId = new Map(rows.map((r) => [String(r._id), r]));

    for (const p of products) {
      const r = byId.get(String(p._id));
      p.rating = r ? { average: Math.round(r.average * 10) / 10, total: r.total } : { average: 0, total: 0 };
    }
  }

  res.json(products);
}

export const getOne = asyncHandler(async (req, res) => {
  const { slugOrId } = req.params;
  const query = /^[a-f\d]{24}$/i.test(slugOrId) ? { _id: slugOrId } : { slug: slugOrId };

  const product = await Product.findOne(query).populate('category', 'name slug');
  if (!product) return res.status(404).json({ error: 'Product not found' });

  res.json(product);
});

export const create = asyncHandler(async (req, res) => {
  const { name, description, category, price, cost, tags, isSpicy, isVegetarian, available, featured, sortOrder } = req.body;

  if (!name) return res.status(400).json({ error: 'Product name is required' });
  if (!category) return res.status(400).json({ error: 'Please pick a category' });

  const variants = parseVariants(req.body.variants);
  if (!variants.length && !(Number(price) > 0)) {
    return res.status(400).json({ error: 'Add a price, or add at least one option with a price' });
  }

  const product = await Product.create({
    name,
    slug: await uniqueSlug(Product, name),
    description,
    category,
    images: parseImages(req.body.images),
    price: Number(price) || 0,
    variants,
    cost: Number(cost) || 0,
    tags,
    isSpicy,
    isVegetarian,
    available,
    featured,
    sortOrder,
  });

  await product.populate('category', 'name slug');
  res.status(201).json(product);
});

export const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const { name, description, category, price, cost, tags, isSpicy, isVegetarian, available, featured, sortOrder } = req.body;

  if (name && name !== product.name) {
    product.name = name;
    product.slug = await uniqueSlug(Product, name, id);
  }
  if (description !== undefined) product.description = description;
  if (category !== undefined) product.category = category;
  if (price !== undefined) product.price = Number(price) || 0;
  if (cost !== undefined) product.cost = Number(cost) || 0;
  if (tags !== undefined) product.tags = tags;
  if (isSpicy !== undefined) product.isSpicy = Boolean(isSpicy);
  if (isVegetarian !== undefined) product.isVegetarian = Boolean(isVegetarian);
  if (available !== undefined) product.available = Boolean(available);
  if (featured !== undefined) product.featured = Boolean(featured);
  if (sortOrder !== undefined) product.sortOrder = sortOrder;
  if (req.body.images !== undefined) product.images = parseImages(req.body.images);
  if (req.body.variants !== undefined) product.variants = parseVariants(req.body.variants);

  await product.save();
  await product.populate('category', 'name slug');

  res.json(product);
});

export const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findByIdAndDelete(id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.status(204).end();
});

// one-click availability toggle for the admin list
export const toggleAvailability = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  product.available = !product.available;
  await product.save();

  res.json({ id: product._id, available: product.available });
});
