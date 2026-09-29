import Deal from '../models/Deal.js';
import Product from '../models/Product.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { uniqueSlug } from './categoryController.js';

// customers only see deals inside their start/end window
function liveFilter(includeAll) {
  if (includeAll) return {};
  const now = new Date();
  return {
    available: true,
    startsAt: { $lte: now },
    endsAt: { $gte: now },
  };
}

async function hydrate(deals) {
  const populated = await Promise.all(
    deals.map((deal) => Deal.populate(deal, { path: 'items.product', select: 'name images slug' }))
  );
  return populated;
}

export const list = asyncHandler(async (req, res) => {
  const { includeAll, featured } = req.query;
  const filter = liveFilter(includeAll === 'true');
  if (featured === 'true') filter.featured = true;

  const deals = await Deal.find(filter)
    .sort({ sortOrder: 1, endsAt: 1 })
    .lean({ virtuals: true });

  const hydrated = await hydrate(deals);
  res.json(hydrated);
});

export const getOne = asyncHandler(async (req, res) => {
  const { slugOrId } = req.params;
  const query = /^[a-f\d]{24}$/i.test(slugOrId) ? { _id: slugOrId } : { slug: slugOrId };

  const deal = await Deal.findOne(query);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  const [hydrated] = await hydrate([deal]);
  res.json(hydrated);
});

// admin timeline: everything, grouped by whether it is running / upcoming / finished
export const timeline = asyncHandler(async (req, res) => {
  const deals = await Deal.find().sort({ endsAt: -1 }).lean({ virtuals: true });
  const now = new Date();

  const groups = { running: [], upcoming: [], finished: [] };
  deals.forEach((deal) => {
    if (deal.startsAt > now) groups.upcoming.push(deal);
    else if (deal.endsAt < now) groups.finished.push(deal);
    else groups.running.push(deal);
  });

  res.json({ ...groups, all: deals, now });
});

export const create = asyncHandler(async (req, res) => {
  const { name, description, price, compareAtPrice, image, imagePublicId, badge, startsAt, endsAt, available, featured, sortOrder } = req.body;

  if (!name) return res.status(400).json({ error: 'Deal name is required' });
  if (!(Number(price) > 0)) return res.status(400).json({ error: 'Deal price must be greater than zero' });
  if (!endsAt) return res.status(400).json({ error: 'Set an end date so the deal knows when to stop showing' });

  const items = await resolveItems(req.body.items);

  // "buy separately" price is whatever the components cost on their own
  const derivedCompareAt = items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);

  const deal = await Deal.create({
    name,
    slug: await uniqueSlug(Deal, name),
    description,
    items,
    compareAtPrice: Number(compareAtPrice) > 0 ? Number(compareAtPrice) : derivedCompareAt,
    price: Number(price),
    image,
    imagePublicId,
    badge,
    startsAt: startsAt ? new Date(startsAt) : new Date(),
    endsAt: new Date(endsAt),
    available,
    featured,
    sortOrder,
  });

  const [hydrated] = await hydrate([deal.toObject()]);
  res.status(201).json(hydrated);
});

export const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deal = await Deal.findById(id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  const { name, description, price, compareAtPrice, image, imagePublicId, badge, startsAt, endsAt, available, featured, sortOrder } = req.body;

  if (name && name !== deal.name) {
    deal.name = name;
    deal.slug = await uniqueSlug(Deal, name, id);
  }
  if (description !== undefined) deal.description = description;
  if (price !== undefined) deal.price = Number(price);
  if (compareAtPrice !== undefined) deal.compareAtPrice = Number(compareAtPrice) || 0;
  if (image !== undefined) deal.image = image;
  if (imagePublicId !== undefined) deal.imagePublicId = imagePublicId;
  if (badge !== undefined) deal.badge = badge;
  if (startsAt !== undefined) deal.startsAt = new Date(startsAt);
  if (endsAt !== undefined) deal.endsAt = new Date(endsAt);
  if (available !== undefined) deal.available = Boolean(available);
  if (featured !== undefined) deal.featured = Boolean(featured);
  if (sortOrder !== undefined) deal.sortOrder = sortOrder;
  if (req.body.items !== undefined) {
    deal.items = await resolveItems(req.body.items);
    // keep the struck-through price in step with the bundle contents
    deal.compareAtPrice = deal.items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
  }

  await deal.save();

  const [hydrated] = await hydrate([deal.toObject()]);
  res.json(hydrated);
});

export const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deal = await Deal.findByIdAndDelete(id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });
  res.status(204).end();
});

/**
 * Turns [{ product, qty }] into bundle lines, snapshotting name/price/cost
 * so an old order never changes when the menu is re-priced.
 */
async function resolveItems(rawItems) {
  if (!Array.isArray(rawItems) || !rawItems.length) {
    const err = new Error('Add at least one item to the bundle');
    err.status = 400;
    throw err;
  }

  const ids = rawItems.map((i) => i.product).filter(Boolean);
  const products = await Product.find({ _id: { $in: ids } });
  const byId = new Map(products.map((p) => [String(p._id), p]));

  return rawItems.map((item) => {
    const product = byId.get(String(item.product));
    if (!product) {
      const err = new Error('One of the selected items no longer exists');
      err.status = 400;
      throw err;
    }

    const qty = Math.max(1, parseInt(item.qty, 10) || 1);
    const unitPrice = Number(item.unitPrice) > 0 ? Number(item.unitPrice) : product.price;

    return {
      product: product._id,
      name: product.name,
      qty,
      unitPrice,
      cost: product.cost || 0,
    };
  });
}
