import mongoose from 'mongoose';

const DealItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    qty: { type: Number, default: 1, min: 1 },
    // price of a single unit inside the bundle
    unitPrice: { type: Number, default: 0, min: 0 },
    cost: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const DealSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
    items: { type: [DealItemSchema], default: [] },
    // sum of items sold individually; shown struck through next to the deal price
    compareAtPrice: { type: Number, default: 0, min: 0 },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, default: '' },
    imagePublicId: { type: String, default: '' },
    badge: { type: String, default: '' },
    // the timeline: deal is only visible to customers between these two dates
    startsAt: { type: Date, default: Date.now },
    endsAt: { type: Date, required: true },
    available: { type: Boolean, default: true },
    featured: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

DealSchema.virtual('savings').get(function () {
  return Math.max(0, Math.round(((this.compareAtPrice || 0) - (this.price || 0)) * 100) / 100);
});

DealSchema.virtual('discountPercent').get(function () {
  if (!this.compareAtPrice) return 0;
  return Math.round(((this.compareAtPrice - this.price) / this.compareAtPrice) * 100);
});

DealSchema.virtual('isLive').get(function () {
  const now = new Date();
  return this.available && this.startsAt <= now && this.endsAt >= now;
});

DealSchema.set('toJSON', { virtuals: true });
DealSchema.index({ available: 1, startsAt: 1, endsAt: 1 });

export default mongoose.model('Deal', DealSchema);
