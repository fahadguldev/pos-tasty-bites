import Setting, { getSettings } from '../models/Setting.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { normalisePhone } from '../utils/format.js';

const PAYMENT_CODES = ['cod', 'jazzcash', 'easypaisa', 'bank', 'card', 'other'];

// what the storefront is allowed to see — never leaks account numbers it does not need
function publicView(settings) {
  return {
    shopName: settings.shopName,
    tagline: settings.tagline,
    logo: settings.logo,
    coverImage: settings.coverImage,
    about: settings.about,
    address: settings.address,
    city: settings.city,
    phone: settings.phone,
    whatsappNumber: settings.whatsappNumber,
    deliveryFee: settings.deliveryFee,
    freeDeliveryAbove: settings.freeDeliveryAbove,
    minOrderValue: settings.minOrderValue,
    estimatedDeliveryMinutes: settings.estimatedDeliveryMinutes,
    acceptingOrders: settings.acceptingOrders,
    closedNotice: settings.closedNotice,
    social: settings.social,
    paymentMethods: (settings.paymentMethods || [])
      .filter((m) => m.active)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((m) => ({
        code: m.code,
        label: m.label,
        // transfer details are only revealed for methods that need them
        accountTitle: m.code === 'cod' ? '' : m.accountTitle,
        accountNumber: m.code === 'cod' ? '' : m.accountNumber,
        instructions: m.instructions,
      })),
  };
}

export const getPublic = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  res.json(publicView(settings));
});

export const getAdmin = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  res.json(settings);
});

export const update = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const body = req.body || {};

  const textFields = [
    'shopName', 'tagline', 'logo', 'coverImage', 'about',
    'address', 'city', 'phone', 'closedNotice',
  ];
  textFields.forEach((field) => {
    if (body[field] !== undefined) settings[field] = body[field];
  });

  const numberFields = ['deliveryFee', 'freeDeliveryAbove', 'minOrderValue', 'estimatedDeliveryMinutes'];
  numberFields.forEach((field) => {
    if (body[field] !== undefined) settings[field] = Math.max(0, Number(body[field]) || 0);
  });

  if (body.whatsappNumber !== undefined) {
    settings.whatsappNumber = normalisePhone(body.whatsappNumber);
  }
  if (body.acceptingOrders !== undefined) settings.acceptingOrders = Boolean(body.acceptingOrders);

  if (body.social !== undefined) {
    settings.social = {
      facebook: body.social.facebook ?? settings.social.facebook,
      instagram: body.social.instagram ?? settings.social.instagram,
      tiktok: body.social.tiktok ?? settings.social.tiktok,
    };
  }

  if (Array.isArray(body.paymentMethods)) {
    settings.paymentMethods = body.paymentMethods
      .filter((m) => m && m.code && PAYMENT_CODES.includes(m.code) && m.label)
      .map((m, index) => ({
        code: m.code,
        label: String(m.label).trim(),
        accountTitle: String(m.accountTitle || '').trim(),
        accountNumber: String(m.accountNumber || '').trim(),
        instructions: String(m.instructions || '').trim(),
        sortOrder: m.sortOrder ?? index,
        active: m.active !== false,
      }));
  }

  await settings.save();
  res.json(settings);
});

/** Fills in sensible payment methods the first time the shop is set up */
export const seedPaymentMethods = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  if (settings.paymentMethods?.length) {
    return res.json(settings);
  }

  settings.paymentMethods = [
    { code: 'cod', label: 'Cash on delivery', accountTitle: '', accountNumber: '', instructions: 'Pay the rider when your order arrives.', sortOrder: 0, active: true },
    { code: 'jazzcash', label: 'JazzCash', accountTitle: '', accountNumber: '', instructions: 'Send the amount to this number and share the transaction ID.', sortOrder: 1, active: true },
    { code: 'easypaisa', label: 'Easypaisa', accountTitle: '', accountNumber: '', instructions: 'Send the amount to this number and share the transaction ID.', sortOrder: 2, active: true },
  ];

  await settings.save();
  res.json(settings);
});

export { publicView };
