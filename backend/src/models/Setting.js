import mongoose from 'mongoose';

const PaymentAccountSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, enum: ['cod', 'jazzcash', 'easypaisa', 'bank', 'card', 'other'] },
    label: { type: String, required: true },
    accountTitle: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    instructions: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { _id: false }
);

const SettingSchema = new mongoose.Schema(
  {
    // single document holding every shop-wide setting
    shopName: { type: String, default: 'Tasty Bites' },
    tagline: { type: String, default: 'Fast food, delivered fresh to your door' },
    logo: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    about: { type: String, default: '' },

    address: { type: String, default: '' },
    city: { type: String, default: 'Lodhran' },
    phone: { type: String, default: '' },
    // stored without the + sign, digits only, e.g. 923001234567
    whatsappNumber: { type: String, default: '923335547222' },

    deliveryFee: { type: Number, default: 0, min: 0 },
    freeDeliveryAbove: { type: Number, default: 0, min: 0 },
    minOrderValue: { type: Number, default: 0, min: 0 },
    estimatedDeliveryMinutes: { type: Number, default: 40, min: 5 },

    // true while the shop is taking orders; the storefront shows a closed banner
    acceptingOrders: { type: Boolean, default: true },
    // true outside the given hours so the storefront warns but still allows ordering
    closedNotice: { type: String, default: '' },

    paymentMethods: { type: [PaymentAccountSchema], default: [] },
    social: {
      facebook: { type: String, default: '' },
      instagram: { type: String, default: '' },
      tiktok: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

export const DEFAULT_SETTINGS = {
  shopName: 'Tasty Bites',
  tagline: 'Fast food, delivered fresh to your door',
  city: 'Lodhran',
  whatsappNumber: '923335547222',
  deliveryFee: 0,
  freeDeliveryAbove: 0,
  minOrderValue: 0,
  estimatedDeliveryMinutes: 40,
  acceptingOrders: true,
};

export async function getSettings() {
  let settings = await Setting.findOne();
  if (!settings) settings = await Setting.create(DEFAULT_SETTINGS);
  return settings;
}

const Setting = mongoose.model('Setting', SettingSchema);
export default Setting;
