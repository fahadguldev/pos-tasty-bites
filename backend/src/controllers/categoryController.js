import Category from '../models/Category.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { slugify } from '../utils/format.js';

// keeps slugs unique by appending -2, -3, ... when a name repeats
async function uniqueSlug(model, name, excludeId) {
  const base = slugify(name) || 'item';
  let slug = base;
  let n = 2;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const clash = await model.findOne({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) });
    if (!clash) return slug;
    slug = `${base}-${n++}`;
  }
}

export const list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.includeInactive !== 'true') filter.active = true;

  const categories = await Category.find(filter).sort({ sortOrder: 1, name: 1 }).lean({ virtuals: true });
  res.json(categories);
});

export const create = asyncHandler(async (req, res) => {
  const { name, icon, description, sortOrder, active } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name is required' });

  const category = await Category.create({
    name,
    slug: await uniqueSlug(Category, name),
    icon,
    description,
    sortOrder,
    active,
  });

  res.status(201).json(category);
});

export const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, icon, description, sortOrder, active } = req.body;

  const category = await Category.findById(id);
  if (!category) return res.status(404).json({ error: 'Category not found' });

  if (name && name !== category.name) {
    category.name = name;
    category.slug = await uniqueSlug(Category, name, id);
  }
  if (icon !== undefined) category.icon = icon;
  if (description !== undefined) category.description = description;
  if (sortOrder !== undefined) category.sortOrder = sortOrder;
  if (active !== undefined) category.active = active;

  await category.save();
  res.json(category);
});

export const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const category = await Category.findByIdAndDelete(id);
  if (!category) return res.status(404).json({ error: 'Category not found' });
  res.status(204).end();
});

export { uniqueSlug };
