import mongoose from 'mongoose';

const VariantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true },
  },
  { _id: false }
);

const ImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: '' },
  },
  { _id: false }
);

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    images: { type: [ImageSchema], default: [] },
    // price when the product has no variants
    price: { type: Number, default: 0, min: 0 },
    variants: { type: [VariantSchema], default: [] },
    // what the cafe pays for the item; drives profit reporting
    cost: { type: Number, default: 0, min: 0 },
    tags: { type: [String], default: [] },
    isSpicy: { type: Boolean, default: false },
    isVegetarian: { type: Boolean, default: false },
    available: { type: Boolean, default: true },
    featured: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ProductSchema.virtual('effectivePrice').get(function () {
  if (this.variants?.length) {
    const prices = this.variants.filter((v) => v.active).map((v) => v.price);
    if (prices.length) return Math.min(...prices);
  }
  return this.price || 0;
});

ProductSchema.set('toJSON', { virtuals: true });
ProductSchema.index({ name: 'text', description: 'text' });
ProductSchema.index({ category: 1, available: 1 });

export default mongoose.model('Product', ProductSchema);
