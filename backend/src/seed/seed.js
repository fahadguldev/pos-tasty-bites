import mongoose from 'mongoose';
import dotenv from 'dotenv';
import '../config/mongoose.js'; // must load before any model is compiled
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Deal from '../models/Deal.js';
import Setting, { DEFAULT_SETTINGS } from '../models/Setting.js';
import Review from '../models/Review.js';
import Order from '../models/Order.js';
import Counter from '../models/Counter.js';
import Admin from '../models/Admin.js';

dotenv.config();

const RESET = process.argv.includes('--reset');

const CATEGORIES = [
  { name: 'Burgers', icon: 'burger', sortOrder: 1 },
  { name: 'Deals & Bundles', icon: 'tag', sortOrder: 2 },
  { name: 'Pizza', icon: 'pizza', sortOrder: 3 },
  { name: 'Fried Chicken', icon: 'drumstick', sortOrder: 4 },
  { name: 'Rolls & Wraps', icon: 'wrap', sortOrder: 5 },
  { name: 'Fries & Sides', icon: 'fries', sortOrder: 6 },
  { name: 'Pasta', icon: 'pasta', sortOrder: 7 },
  { name: 'Shakes & Juices', icon: 'shake', sortOrder: 8 },
  { name: 'Drinks', icon: 'drink', sortOrder: 9 },
  { name: 'Desserts', icon: 'dessert', sortOrder: 10 },
];

// price bands follow what similar fast food in Lodhran charges
const PRODUCTS = [
  // Burgers
  { name: 'Zinger Burger', category: 'Burgers', price: 450, cost: 190, description: 'Crispy fried chicken fillet, lettuce, mayo and a kick of sauce in a toasted bun.', tags: ['bestseller', 'spicy'], isSpicy: true, featured: true },
  { name: 'Tower Burger', category: 'Burgers', price: 650, cost: 280, description: 'Double patty, cheese slice and our signature tower sauce.', tags: ['bestseller'], featured: true },
  { name: 'Classic Beef Burger', category: 'Burgers', price: 400, cost: 165, description: 'Flame-grilled beef patty with fresh salad and house sauce.', isVegetarian: false },
  { name: 'Chicken Patty Burger', category: 'Burgers', price: 380, cost: 155, description: 'Flame-grilled chicken patty, mayo and pickles.', isVegetarian: false },
  { name: 'Double Cheese Burger', category: 'Burgers', price: 700, cost: 300, description: 'Two beef patties, double cheese. For serious hunger.', isVegetarian: false, tags: ['spicy'] },
  { name: 'Hot & Spicy Burger', category: 'Burgers', price: 520, cost: 215, description: 'For people who like it hot. Jalapeños, chilli mayo and crisp onions.', isSpicy: true },
  { name: 'Tower Zinger', category: 'Burgers', price: 780, cost: 340, description: 'Our biggest burger. Double zinger fillet, cheese and hot sauce.', isSpicy: true, featured: true },
  { name: 'Grilled Chicken Burger', category: 'Burgers', price: 480, cost: 200, description: 'Charcoal grilled chicken breast, mayo and lettuce.' },

  // Pizza
  { name: 'Cheese Lover Pizza', category: 'Pizza', price: 650, cost: 270, description: 'Double cheese, mozzarella and herbs. Sizes below.', featured: true, variants: [
    { name: 'Small 8"', price: 650 },
    { name: 'Medium 12"', price: 1000 },
    { name: 'Large 14"', price: 1350 },
  ] },
  { name: 'Chicken Tikka Pizza', category: 'Pizza', price: 780, cost: 330, description: 'Spicy tikka chicken, onion, capsicum and mozzarella.', isSpicy: true, featured: true, variants: [
    { name: 'Small 8"', price: 780 },
    { name: 'Medium 12"', price: 1150 },
    { name: 'Large 14"', price: 1550 },
  ] },
  { name: 'Pepperoni Pizza', category: 'Pizza', price: 820, cost: 350, description: 'Loaded pepperoni with mozzarella and oregano.', variants: [
    { name: 'Small 8"', price: 820 },
    { name: 'Medium 12"', price: 1200 },
    { name: 'Large 14"', price: 1650 },
  ] },
  { name: 'Malai Boti Pizza', category: 'Pizza', price: 850, cost: 360, description: 'Creamy malai boti, sweet corn and mozzarella. Our mildest crowd-pleaser.', isSpicy: false, featured: true, variants: [
    { name: 'Small 8"', price: 850 },
    { name: 'Medium 12"', price: 1250 },
    { name: 'Large 14"', price: 1700 },
  ] },
  { name: 'Tasty Bites Special Pizza', category: 'Pizza', price: 1100, cost: 470, description: 'A bit of everything — tikka, pepperoni, capsicum, onion and olives.', featured: true, variants: [
    { name: 'Medium 12"', price: 1100 },
    { name: 'Large 14"', price: 1550 },
  ] },
  { name: 'Hot & Spicy Pizza', category: 'Pizza', price: 800, cost: 340, description: 'Chicken, jalapeño and red chilli. Proper hot.', isSpicy: true, variants: [
    { name: 'Small 8"', price: 800 },
    { name: 'Medium 12"', price: 1180 },
    { name: 'Large 14"', price: 1600 },
  ] },

  // Fried chicken
  { name: '1 Chicken Piece', category: 'Fried Chicken', price: 250, cost: 105, description: 'One crispy fried chicken leg.' },
  { name: 'Chicken Nuggets 5pc', category: 'Fried Chicken', price: 300, cost: 125, description: 'Five golden nuggets with dip.' },
  { name: 'Chicken Nuggets 10pc', category: 'Fried Chicken', price: 550, cost: 230, description: 'Ten golden nuggets with dip. Feeds two.' },
  { name: 'Hot Shots 10pc', category: 'Fried Chicken', price: 420, cost: 175, description: 'Ten fiery buffalo-style bites.', isSpicy: true },
  { name: 'Honey Wings 10pc', category: 'Fried Chicken', price: 900, cost: 380, description: 'Ten wings glazed in sticky honey.' },
  { name: 'BBQ Wings 10pc', category: 'Fried Chicken', price: 850, cost: 360, description: 'Ten wings tossed in smoky BBQ sauce.' },
  { name: 'Crispy Wings 10pc', category: 'Fried Chicken', price: 780, cost: 330, description: 'Ten lightly seasoned crispy wings.' },

  // Rolls & wraps
  { name: 'Chicken Tikka Roll', category: 'Rolls & Wraps', price: 380, cost: 160, description: 'Tikka chicken, onion, salad and raita in a paratha roll.', isSpicy: true, featured: true },
  { name: 'Zinger Roll', category: 'Rolls & Wraps', price: 420, cost: 175, description: 'Crispy zinger fillet with mayo and salad.', featured: true },
  { name: 'Zinger Wrap', category: 'Rolls & Wraps', price: 450, cost: 190, description: 'Our zinger fillet in a tortilla wrap with cheese.' },
  { name: 'Chicken Shawarma', category: 'Rolls & Wraps', price: 300, cost: 125, description: 'Shawarma chicken, garlic sauce, pickles.', isSpicy: true },
  { name: 'Twister Roll', category: 'Rolls & Wraps', price: 400, cost: 165, description: 'Chicken, fries and sauce twisted in paratha.' },

  // Fries & sides
  { name: 'Plain Fries', category: 'Fries & Sides', price: 200, cost: 80, description: 'Straight cut fries.', variants: [
    { name: 'Regular', price: 200 },
    { name: 'Large', price: 300 },
  ] },
  { name: 'Cheesy Fries', category: 'Fries & Sides', price: 420, cost: 170, description: 'Fries loaded with cheese sauce.', featured: true },
  { name: 'Loaded Fries', category: 'Fries & Sides', price: 750, cost: 310, description: 'Fries, cheese sauce, jalapeño, olives and chicken bites.' },
  { name: 'Garlic Fries', category: 'Fries & Sides', price: 320, cost: 130, description: 'Fries tossed in garlic butter.' },
  { name: 'Dip Sauce', category: 'Fries & Sides', price: 70, cost: 20, description: 'Garlic, chilli, mayo or BBQ.' },
  { name: 'Coleslaw', category: 'Fries & Sides', price: 120, cost: 40, description: 'Fresh cabbage and carrot slaw.' },

  // Pasta
  { name: 'Creamy Chicken Pasta', category: 'Pasta', price: 680, cost: 280, description: 'Fettuccine in a creamy garlic sauce with chicken.' },
  { name: 'Arrabiata Pasta', category: 'Pasta', price: 620, cost: 250, description: 'Penne in a fiery tomato and chilli sauce.', isSpicy: true },
  { name: 'Behari Pasta', category: 'Pasta', price: 700, cost: 290, description: 'Penne with deshiviated tikka and cream.', isSpicy: true, featured: true },
  { name: 'Lasagna', category: 'Pasta', price: 750, cost: 320, description: 'Layered pasta baked with meat sauce and béchamel.' },

  // Shakes & juices
  { name: 'Mango Shake', category: 'Shakes & Juices', price: 250, cost: 95, description: 'Thick mango milkshake.', isVegetarian: true, featured: true },
  { name: 'Banana Shake', category: 'Shakes & Juices', price: 230, cost: 85, description: 'Thick banana milkshake.', isVegetarian: true },
  { name: 'Strawberry Shake', category: 'Shakes & Juices', price: 270, cost: 100, description: 'Fresh strawberry milkshake.', isVegetarian: true },
  { name: 'Chocolate Shake', category: 'Shakes & Juices', price: 300, cost: 115, description: 'Chocolate and cream shake.', isVegetarian: true },
  { name: 'Falsa Juice', category: 'Shakes & Juices', price: 220, cost: 80, description: 'Famous Lodhran summer cooler.', isVegetarian: true },
  { name: 'Aloo Bukhara Juice', category: 'Shakes & Juices', price: 230, cost: 85, description: 'Plum juice, sweet and cooling.', isVegetarian: true },
  { name: 'Fresh Lime Soda', category: 'Shakes & Juices', price: 180, cost: 60, description: 'Chilled lime with soda.', isVegetarian: true },

  // Drinks
  { name: 'Soft Drink Can', category: 'Drinks', price: 150, cost: 95, description: 'Chilled 330ml can.', variants: [
    { name: 'Regular', price: 150 },
    { name: '1.5L Bottle', price: 280 },
  ] },
  { name: 'Mineral Water', category: 'Drinks', price: 60, cost: 35, description: 'Chilled 1.5 litre bottle.' },
  { name: 'Tea (Doodh Patti)', category: 'Drinks', price: 80, cost: 30, description: 'Pakistani chai with milk.', isVegetarian: true },
  { name: 'Coffee', category: 'Drinks', price: 180, cost: 65, description: 'Hot coffee with milk and sugar.', isVegetarian: true },

  // Desserts
  { name: 'Chocolate Sundae', category: 'Desserts', price: 280, cost: 110, description: 'Vanilla ice cream with chocolate sauce and sprinkles.', isVegetarian: true },
  { name: 'Kunafa Sundae', category: 'Desserts', price: 380, cost: 160, description: 'Shredded kunafa with ice cream and honey.', isVegetarian: true, featured: true },
  { name: 'Pistachio Cheesecake', category: 'Desserts', price: 420, cost: 180, description: 'Creamy cheesecake slice with pistachio.', isVegetarian: true },
];

function daysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

const DEALS = [
  {
    name: 'Midnight Munch Deal',
    badge: 'Till 1 AM',
    price: 999,
    description: 'Two zinger burgers, large fries and two drinks. Our busiest late-night order.',
    startsAt: daysFromNow(-1),
    endsAt: daysFromNow(30),
    featured: true,
    items: [
      { product: 'Zinger Burger', qty: 2, unitPrice: 450 },
      { product: 'Plain Fries', qty: 1, unitPrice: 300, variantName: 'Large' },
      { product: 'Soft Drink Can', qty: 2, unitPrice: 150 },
    ],
  },
  {
    name: 'Family Dinner Box',
    badge: 'Feeds 4',
    price: 2499,
    description: 'Two large pizzas, eight nuggets, large fries and four drinks.',
    startsAt: daysFromNow(-5),
    endsAt: daysFromNow(45),
    featured: true,
    items: [
      { product: 'Tasty Bites Special Pizza', qty: 2, unitPrice: 1550, variantName: 'Large 14"' },
      { product: 'Chicken Nuggets 10pc', qty: 1, unitPrice: 550 },
      { product: 'Plain Fries', qty: 1, unitPrice: 300, variantName: 'Large' },
      { product: 'Soft Drink Can', qty: 4, unitPrice: 150 },
    ],
  },
  {
    name: 'Student Pocket Deal',
    badge: 'Budget',
    price: 549,
    description: 'Zinger burger, regular fries and a drink. Cheapest way to try us.',
    startsAt: daysFromNow(-2),
    endsAt: daysFromNow(20),
    items: [
      { product: 'Zinger Burger', qty: 1, unitPrice: 450 },
      { product: 'Plain Fries', qty: 1, unitPrice: 200, variantName: 'Regular' },
      { product: 'Soft Drink Can', qty: 1, unitPrice: 150 },
    ],
  },
  {
    name: 'Wing Saturday',
    badge: 'Weekend',
    price: 1599,
    description: 'Ten honey wings, eight hot shots, cheesy fries and two drinks.',
    startsAt: daysFromNow(1),
    endsAt: daysFromNow(14),
    items: [
      { product: 'Honey Wings 10pc', qty: 1, unitPrice: 900 },
      { product: 'Hot Shots 10pc', qty: 1, unitPrice: 420 },
      { product: 'Cheesy Fries', qty: 1, unitPrice: 420 },
      { product: 'Soft Drink Can', qty: 2, unitPrice: 150 },
    ],
  },
  {
    name: 'Lunch Express',
    badge: '11am - 4pm',
    price: 699,
    description: 'Tikka roll, cheesy fries and a drink. Fast and filling.',
    startsAt: daysFromNow(0),
    endsAt: daysFromNow(10),
    items: [
      { product: 'Chicken Tikka Roll', qty: 1, unitPrice: 380 },
      { product: 'Cheesy Fries', qty: 1, unitPrice: 420 },
      { product: 'Soft Drink Can', qty: 1, unitPrice: 150 },
    ],
  },
  {
    name: 'Ramzan Special Iftar Box',
    badge: 'Limited',
    price: 1899,
    description: 'One large pizza, samosas, pakoras, biryani and a drink. Built for iftar.',
    startsAt: daysFromNow(3),
    endsAt: daysFromNow(7),
    items: [
      { product: 'Chicken Tikka Pizza', qty: 1, unitPrice: 1550, variantName: 'Large 14"' },
      { product: 'Coleslaw', qty: 1, unitPrice: 120 },
      { product: 'Soft Drink Can', qty: 2, unitPrice: 150 },
    ],
  },
];

const SAMPLE_REVIEWS = [
  { product: 'Tower Burger', customerName: 'Ahmed Raza', rating: 5, comment: 'Best burger in Lodhran, hands down. Big and juicy.' },
  { product: 'Tower Burger', customerName: 'Fatima Noor', rating: 4, comment: 'Really good but quite heavy. Worth it though.' },
  { product: 'Zinger Burger', customerName: 'Bilal Khan', rating: 5, comment: 'Crispy outside, proper spicy. Ordered again on Friday.' },
  { product: 'Malai Boti Pizza', customerName: 'Usman Tariq', rating: 5, comment: 'Not spicy at all and still full of flavour. Kids loved it.' },
  { product: 'Malai Boti Pizza', customerName: 'Sana Malik', rating: 4, comment: 'Medium size is perfect for two people.' },
  { product: 'Chicken Tikka Roll', customerName: 'Hassan Ali', rating: 4, comment: 'Good raita, generous filling.' },
  { product: 'Midnight Munch Deal', customerName: 'Zain Abbas', rating: 5, comment: 'Ordered at 12:30am and it still arrived hot. Impressive.' },
  { product: 'Kunafa Sundae', customerName: 'Rabia Fatima', rating: 5, comment: 'Dessert is the highlight. Save room for it.' },
];

const CUSTOMERS = [
  { name: 'Ahmed Raza', phone: '923001111111', address: 'House 12, Street 4, Civil Colony', area: 'Civil Colony', landmark: 'Near mosque' },
  { name: 'Fatima Noor', phone: '923002222222', address: 'Flat 3, Al-Noor Apartments, Main Bazaar Road', area: 'Main Bazaar', landmark: 'Opposite pharmacy' },
  { name: 'Bilal Khan', phone: '923003333333', address: 'House 45, Model Town Block B', area: 'Model Town', landmark: '' },
  { name: 'Usman Tariq', phone: '923004444444', address: 'House 7, Gulberg Road', area: 'Gulberg', landmark: 'Near petrol pump' },
  { name: 'Sana Malik', phone: '923005555555', address: 'House 88, Peoples Colony', area: 'Peoples Colony', landmark: 'Back lane' },
  { name: 'Hassan Ali', phone: '923006666666', address: 'House 21, Station Road', area: 'Station Road', landmark: 'Near railway station' },
  { name: 'Zain Abbas', phone: '923007777777', address: 'House 3, New Colony', area: 'New Colony', landmark: '' },
  { name: 'Rabia Fatima', phone: '923008888888', address: 'House 19, Hassan Road', area: 'Hassan Road', landmark: 'Opposite school' },
];

const SOURCES = ['website', 'website', 'website', 'whatsapp', 'website', 'pos'];
const PAYMENT_METHODS = ['cod', 'cod', 'cod', 'jazzcash', 'easypaisa', 'cod'];
const STATUSES = ['delivered', 'delivered', 'delivered', 'delivered', 'cancelled', 'out_for_delivery', 'confirmed', 'preparing', 'new'];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export async function seed({ reset = false, quiet = false } = {}) {
  const log = quiet ? () => {} : console.log;

  if (reset) {
    await Promise.all([
      Category.deleteMany({}), Product.deleteMany({}), Deal.deleteMany({}),
      Review.deleteMany({}), Order.deleteMany({}), Counter.deleteMany({}),
    ]);
    log('Cleared menu, deals, reviews and orders');
  }

  // ---------- settings ----------
  let settings = await Setting.findOne();
  if (!settings) {
    settings = await Setting.create({
      ...DEFAULT_SETTINGS,
      shopName: 'Tasty Bites',
      tagline: 'Fast food, delivered fresh to your door',
      about:
        'Tasty Bites is a home delivery kitchen serving Lodhran. We marinate our chicken for 24 hours, ' +
        'grill on charcoal where it matters, and deliver hot. No dining room — every order is made to travel.',
      address: 'Main Bazaar Road',
      city: 'Lodhran',
      phone: '03001234567',
      whatsappNumber: '923335547222',
      deliveryFee: 100,
      freeDeliveryAbove: 1500,
      minOrderValue: 400,
      estimatedDeliveryMinutes: 40,
      social: {
        facebook: 'https://www.facebook.com/p/Tasty-bites-Lodhran-61582648830145/',
        instagram: 'https://www.instagram.com/reel/DRQDvVBipIa/',
        tiktok: 'https://www.tiktok.com/discover/tasty-bites-lodhran',
      },
      paymentMethods: [
        { code: 'cod', label: 'Cash on delivery', instructions: 'Pay the rider when your order arrives.', sortOrder: 0, active: true },
        { code: 'jazzcash', label: 'JazzCash', accountTitle: 'Tasty Bites', accountNumber: '', instructions: 'Send the total to this number and share the transaction ID in your order notes.', sortOrder: 1, active: true },
        { code: 'easypaisa', label: 'Easypaisa', accountTitle: 'Tasty Bites', accountNumber: '', instructions: 'Send the total to this number and share the transaction ID in your order notes.', sortOrder: 2, active: true },
      ],
    });
    log('Created shop settings');
  } else {
    log('Settings already exist, leaving them alone (use --reset to rebuild)');
  }

  // ---------- categories ----------
  const categoryMap = new Map();
  for (const c of CATEGORIES) {
    let category = await Category.findOne({ name: c.name });
    if (!category) {
      category = await Category.create({ ...c, slug: c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') });
    }
    categoryMap.set(c.name, category._id);
  }
  log(`Categories ready: ${categoryMap.size}`);

  // ---------- products ----------
  const productMap = new Map();
  for (const p of PRODUCTS) {
    const existing = await Product.findOne({ name: p.name });
    if (existing) {
      productMap.set(p.name, existing);
      continue;
    }
    const { category, variants, ...rest } = p;
    const product = await Product.create({
      ...rest,
      category: categoryMap.get(category),
      price: p.price || 0,
      variants: (variants || []).map((v) => ({ ...v, active: true })),
      slug: p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    });
    productMap.set(p.name, product);
  }
  log(`Products ready: ${productMap.size}`);

  // ---------- deals ----------
  for (const d of DEALS) {
    if (await Deal.findOne({ name: d.name })) continue;

    const items = d.items.map((i) => {
      const product = productMap.get(i.product);
      return {
        product: product._id,
        name: product.name,
        qty: i.qty,
        unitPrice: i.unitPrice ?? product.price ?? 0,
        cost: product.cost || 0,
      };
    });

    const compareAtPrice = items.reduce((s, i) => s + i.unitPrice * i.qty, 0);

    await Deal.create({
      name: d.name,
      slug: d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      description: d.description,
      items,
      compareAtPrice,
      price: d.price,
      badge: d.badge,
      startsAt: d.startsAt,
      endsAt: d.endsAt,
      available: true,
      featured: Boolean(d.featured),
      sortOrder: 0,
    });
  }
  log('Deals ready');

  // ---------- reviews ----------
  if ((await Review.countDocuments()) === 0) {
    for (const r of SAMPLE_REVIEWS) {
      const product = productMap.get(r.product);
      if (!product) continue;
      await Review.create({ product: product._id, customerName: r.customerName, rating: r.rating, comment: r.comment, approved: true });
    }
    log(`Reviews ready: ${SAMPLE_REVIEWS.length}`);
  }

  // ---------- demo orders so analytics has something to show ----------
  if ((await Order.countDocuments()) === 0) {
    const allProducts = await Product.find().lean();
    const allDeals = await Deal.find().lean();
    const orders = [];
    let seq = 0;

    for (let dayAgo = 89; dayAgo >= 0; dayAgo -= 1) {
      // more orders on weekends, a gentle upward trend over three months
      const date = new Date();
      date.setDate(date.getDate() - dayAgo);
      const isWeekend = [0, 5, 6].includes(date.getDay());
      const growth = 1 + (89 - dayAgo) / 220;
      const base = isWeekend ? 9 : 6;
      const count = Math.max(1, Math.round((base + Math.random() * 4) * growth));

      for (let n = 0; n < count; n += 1) {
        seq += 1;
        const placedAt = new Date(date);
        placedAt.setHours(12 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60), 0, 0);
        // never create future orders
        if (placedAt > new Date()) continue;

        const status = dayAgo > 1 ? pick(['delivered', 'delivered', 'delivered', 'cancelled']) : pick(STATUSES);
        const customer = pick(CUSTOMERS);
        const source = pick(SOURCES);

        const itemCount = 1 + Math.floor(Math.random() * 3);
        const items = [];

        for (let k = 0; k < itemCount; k += 1) {
          if (allDeals.length && Math.random() < 0.35) {
            const deal = pick(allDeals);
            const qty = Math.random() < 0.25 ? 2 : 1;
            items.push({
              kind: 'deal',
              ref: deal._id,
              name: deal.name,
              variantName: '',
              qty,
              unitPrice: deal.price,
              cost: Math.round(deal.items.reduce((s, i) => s + (i.cost || 0) * (i.qty || 1), 0)),
              lineTotal: deal.price * qty,
            });
            continue;
          }

          const product = pick(allProducts);
          const variant = product.variants?.length ? pick(product.variants) : null;
          const unitPrice = variant ? variant.price : product.price;
          const qty = Math.random() < 0.2 ? 2 : 1;

          items.push({
            kind: 'product',
            ref: product._id,
            name: product.name,
            variantName: variant ? variant.name : '',
            qty,
            unitPrice,
            cost: product.cost || 0,
            lineTotal: unitPrice * qty,
          });
        }

        const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
        const cost = items.reduce((s, i) => s + (i.cost || 0) * i.qty, 0);
        const deliveryFee = subtotal >= 1500 ? 0 : 100;
        const total = subtotal + deliveryFee;
        const paymentMethod = pick(PAYMENT_METHODS);

        orders.push({
          orderNo: `TB-${String(seq).padStart(4, '0')}`,
          items,
          customer,
          paymentMethod,
          // anything the customer already paid for is recorded as received
          paymentStatus: paymentMethod === 'cod' ? (status === 'delivered' ? 'received' : 'pending') : pick(['received', 'pending']),
          source,
          status,
          subtotal,
          discount: 0,
          deliveryFee,
          total,
          cost,
          whatsappNotified: true,
          createdAt: placedAt,
          updatedAt: placedAt,
          ...(status === 'delivered' ? { deliveredAt: new Date(placedAt.getTime() + 35 * 60000) } : {}),
        });
      }
    }

    await Order.insertMany(orders);
    await Counter.updateOne({ key: 'order' }, { seq }, { upsert: true });
    log(`Demo orders ready: ${orders.length}`);
  }

  // ---------- admin ----------
  if ((await Admin.countDocuments()) === 0) {
    const email = (process.env.ADMIN_EMAIL || 'admin@tastybites.pk').toLowerCase();
    const password = process.env.ADMIN_PASSWORD || 'tastybites123';
    const admin = new Admin({ name: process.env.ADMIN_NAME || 'Owner', email, role: 'owner' });
    await admin.setPassword(password);
    await admin.save();
    log(`Admin account: ${email} / ${password}`);
  }

  log('Seed complete.');
}

// only run the connection + seed when invoked directly, so index.js can import seed()
const isDirectRun = process.argv[1] && process.argv[1].endsWith('seed.js');

if (isDirectRun) {
  mongoose
    .connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tasty_bites')
    .then(() => seed({ reset: RESET }))
    .then(() => mongoose.disconnect())
    .catch(async (err) => {
      console.error('Seed failed:', err.message);
      await mongoose.disconnect().catch(() => {});
      process.exit(1);
    });
}
