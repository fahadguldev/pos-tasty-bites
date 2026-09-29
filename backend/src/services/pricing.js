import Product from '../models/Product.js';
import Deal from '../models/Deal.js';
import { roundMoney } from '../utils/format.js';

/**
 * Rebuilds an order's money from the database.
 * The client only ever sends { ref, kind, qty, variantName } — never prices.
 * Returns the priced item list plus subtotal/cost so the caller can persist them.
 */
export async function priceCart(cartItems, settings, { checkMinimum = true } = {}) {
  const items = Array.isArray(cartItems) ? cartItems : [];

  if (!items.length) {
    const err = new Error('Your cart is empty');
    err.status = 400;
    throw err;
  }

  const priced = [];
  let subtotal = 0;
  let cost = 0;

  for (const line of items) {
    const qty = Math.max(1, parseInt(line.qty, 10) || 1);

    if (line.kind === 'deal') {
      const deal = await Deal.findById(line.ref);
      if (!deal) {
        const err = new Error('One of the deals in your cart is no longer available');
        err.status = 400;
        throw err;
      }
      if (!deal.isLive) {
        const err = new Error(`"${deal.name}" deal is not running right now`);
        err.status = 400;
        throw err;
      }

      const unitPrice = deal.price;
      const lineTotal = roundMoney(unitPrice * qty);
      subtotal += lineTotal;
      // a bundle's cost is the sum of what its components cost to make
      const dealCost = deal.items.reduce((sum, i) => sum + (i.cost || 0) * (i.qty || 1), 0);

      priced.push({
        kind: 'deal',
        ref: deal._id,
        name: deal.name,
        variantName: '',
        qty,
        unitPrice,
        cost: roundMoney(dealCost),
        lineTotal,
      });
      continue;
    }

    const product = await Product.findById(line.ref);
    if (!product) {
      const err = new Error('One of the items in your cart is no longer available');
      err.status = 400;
      throw err;
    }
    if (!product.available) {
      const err = new Error(`"${product.name}" is sold out right now`);
      err.status = 400;
      throw err;
    }

    let unitPrice = product.price;
    let variantName = '';

    if (line.variantName) {
      const variant = product.variants.find((v) => v.name === line.variantName && v.active);
      if (!variant) {
        const err = new Error(`"${product.name}" is not available in that option`);
        err.status = 400;
        throw err;
      }
      unitPrice = variant.price;
      variantName = variant.name;
    } else if (product.variants.length) {
      const cheapest = product.variants
        .filter((v) => v.active)
        .reduce((min, v) => (v.price < min.price ? v : min), product.variants[0]);
      if (!cheapest.active) {
        const err = new Error(`"${product.name}" is sold out right now`);
        err.status = 400;
        throw err;
      }
      unitPrice = cheapest.price;
      variantName = cheapest.name;
    }

    const lineTotal = roundMoney(unitPrice * qty);
    subtotal += lineTotal;
    cost += (product.cost || 0) * qty;

    priced.push({
      kind: 'product',
      ref: product._id,
      name: product.name,
      variantName,
      qty,
      unitPrice,
      cost: roundMoney(product.cost || 0),
      lineTotal,
    });
  }

  subtotal = roundMoney(subtotal);
  cost = roundMoney(cost);

  const minOrderValue = settings?.minOrderValue || 0;
  if (checkMinimum && minOrderValue && subtotal < minOrderValue) {
    const err = new Error(`Minimum order is Rs ${minOrderValue}`);
    err.status = 400;
    throw err;
  }

  const freeAbove = settings?.freeDeliveryAbove || 0;
  const deliveryFee =
    freeAbove && subtotal >= freeAbove ? 0 : settings?.deliveryFee || 0;

  return {
    items: priced,
    subtotal,
    discount: 0,
    deliveryFee: roundMoney(deliveryFee),
    total: roundMoney(subtotal + deliveryFee),
    cost,
  };
}
