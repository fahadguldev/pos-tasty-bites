import mongoose from 'mongoose';

const ReviewSchema = new mongoose.Schema(
  {
    // a review can point at a product or a deal, never both
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    deal: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal', default: null },
    customerName: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', maxlength: 1000 },
    approved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ReviewSchema.index({ product: 1, approved: 1, createdAt: -1 });
ReviewSchema.index({ deal: 1, approved: 1, createdAt: -1 });

export default mongoose.model('Review', ReviewSchema);
