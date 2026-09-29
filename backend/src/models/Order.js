import mongoose from 'mongoose';

const OrderItemSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['product', 'deal'], default: 'product' },
    ref: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    variantName: { type: String, default: '' },
    qty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    cost: { type: Number, default: 0, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const CustomerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    area: { type: String, default: '' },
    landmark: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    orderNo: { type: String, required: true, unique: true },
    items: { type: [OrderItemSchema], default: [] },
    customer: { type: CustomerSchema, required: true },

    // where the customer chose to pay. recorded so the admin can track collections.
    paymentMethod: {
      type: String,
      enum: ['cod', 'jazzcash', 'easypaisa', 'bank', 'card', 'other'],
      default: 'cod',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'received', 'refunded'],
      default: 'pending',
    },

    // which channel the order came in on
    source: { type: String, enum: ['website', 'whatsapp', 'pos'], default: 'website' },

    status: {
      type: String,
      enum: ['new', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'],
      default: 'new',
    },

    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    deliveryFee: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    cost: { type: Number, default: 0, min: 0 },

    // set once the notification reaches the cafe's WhatsApp
    whatsappNotified: { type: Boolean, default: false },
    whatsappError: { type: String, default: '' },

    cancelledReason: { type: String, default: '' },
    deliveredAt: { type: Date },
  },
  { timestamps: true }
);

OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ 'customer.phone': 1 });

OrderSchema.virtual('profit').get(function () {
  return Math.round(((this.total || 0) - (this.deliveryFee || 0) - (this.cost || 0)) * 100) / 100;
});

OrderSchema.set('toJSON', { virtuals: true });

export default mongoose.model('Order', OrderSchema);
