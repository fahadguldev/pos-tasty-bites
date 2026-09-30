/**
 * Menu read off the WhatsApp photos in
 *   <repo>/WhatsApp Unknown 2026-09-30 at 14.51.55
 *
 * Two printed menu boards (burgers/wraps/snacks + pizzas/starters/broasters)
 * and eleven "Daily Deal" promo posters.
 *
 * Posters were copied to frontend/public/img/whatsapp/ and are referenced
 * by root-relative path, so nothing goes through Cloudinary.
 */

export const IMAGE_BASE = '/img/whatsapp/';

/** Sections the printed menu has but the seeded demo menu does not. */
export const CATEGORIES = [
  { name: 'Starters', icon: 'fries', sortOrder: 11 },
  { name: 'Broasters', icon: 'drumstick', sortOrder: 12 },
];

const V = (small, medium, large) => [
  { name: 'Small 8"', price: small },
  { name: 'Medium 12"', price: medium },
  { name: 'Large 14"', price: large },
];

const V2 = (medium, large) => [
  { name: 'Medium 12"', price: medium },
  { name: 'Large 14"', price: large },
];

/**
 * `name` is the upsert key (exact match against the existing menu).
 * `menuLabel` is only the wording used on the printed board, kept so the
 * import log can show what line of the menu a row came from.
 */
export const PRODUCTS = [
  // ---- burgers ------------------------------------------------------------
  { menuLabel: 'ZINGER BURGER', name: 'Zinger Burger', category: 'Burgers', price: 330 },
  { menuLabel: 'PATTY BURGER', name: 'Patty Burger', category: 'Burgers', price: 260 },
  { menuLabel: 'CHAPLI BURGER', name: 'Chapli Burger', category: 'Burgers', price: 260 },
  { menuLabel: 'DOUBLE DECKER', name: 'Double Decker', category: 'Burgers', price: 520 },
  { menuLabel: 'DOUBLE PATTY', name: 'Double Patty', category: 'Burgers', price: 450 },
  { menuLabel: 'TOWER BURGER', name: 'Tower Burger', category: 'Burgers', price: 550 },
  { menuLabel: 'TASTY BITE SPECIAL BURGER', name: 'Tasty Bite Special Burger', category: 'Burgers', price: 430 },

  // ---- wraps --------------------------------------------------------------
  { menuLabel: 'ZINGER SHAWARMA', name: 'Zinger Shawarma', category: 'Rolls & Wraps', price: 250 },
  { menuLabel: 'CHICKEN SHAWARMA', name: 'Chicken Shawarma', category: 'Rolls & Wraps', price: 190 },
  { menuLabel: 'CHEESE SHAWARMA', name: 'Cheese Shawarma', category: 'Rolls & Wraps', price: 320 },
  { menuLabel: 'ZINGER PRATHA', name: 'Zinger Pratha', category: 'Rolls & Wraps', price: 330 },
  { menuLabel: 'KABAB ROLL', name: 'Kabab Roll', category: 'Rolls & Wraps', price: 330 },
  { menuLabel: 'BBQ ROLL', name: 'BBQ Roll', category: 'Rolls & Wraps', price: 350 },
  { menuLabel: 'CHEESE PRATHA ROLL', name: 'Cheese Pratha Roll', category: 'Rolls & Wraps', price: 380 },
  { menuLabel: 'BEHARI ROLL 350 / 650', name: 'Behari Roll', category: 'Rolls & Wraps', variants: [
    { name: 'Regular', price: 350 },
    { name: 'Large', price: 650 },
  ] },

  // ---- snacks / sides -----------------------------------------------------
  { menuLabel: 'REG./MEDIUM/FULL FRIES 150 / 220 / 320', name: 'Plain Fries', category: 'Fries & Sides', variants: [
    { name: 'Regular', price: 150 },
    { name: 'Medium', price: 220 },
    { name: 'Full', price: 320 },
  ] },
  { menuLabel: 'CHICKEN CHEESE LOADED FRIES 550', name: 'Loaded Fries', category: 'Fries & Sides', price: 550 },

  // ---- fried chicken ------------------------------------------------------
  { menuLabel: 'NUGGETS (5 PCS) 280', name: 'Chicken Nuggets 5pc', category: 'Fried Chicken', price: 280 },
  { menuLabel: 'NUGGETS (10 PCS) 500', name: 'Chicken Nuggets 10pc', category: 'Fried Chicken', price: 500 },
  { menuLabel: 'HOT WINGS (5/10 PCS) 300 / 550', name: 'Hot Wings', category: 'Fried Chicken', variants: [
    { name: '5 Pieces', price: 300 },
    { name: '10 Pieces', price: 550 },
  ] },
  { menuLabel: 'OVEN BAKED WINGS (5/10 PCS) 350 / 650', name: 'Oven Baked Wings', category: 'Fried Chicken', variants: [
    { name: '5 Pieces', price: 350 },
    { name: '10 Pieces', price: 650 },
  ] },
  { menuLabel: '12 HOT SHOTS (poster only)', name: 'Hot Shots 12pc', category: 'Fried Chicken', price: 500, estimated: true },

  // ---- regular pizzas -----------------------------------------------------
  { menuLabel: 'TIKKA (regular)', name: 'Chicken Tikka Pizza', category: 'Pizza', variants: V(500, 900, 1350) },
  { menuLabel: 'FAJITA (regular)', name: 'Fajita Pizza', category: 'Pizza', variants: V(500, 900, 1350) },
  { menuLabel: 'ACHARI (regular)', name: 'Achari Pizza', category: 'Pizza', variants: V(500, 900, 1350) },
  { menuLabel: 'TANDOORI (regular)', name: 'Tandoori Pizza', category: 'Pizza', variants: V(500, 900, 1350) },
  { menuLabel: 'BBQ (regular)', name: 'BBQ Pizza', category: 'Pizza', variants: V(500, 900, 1350) },
  { menuLabel: 'SUPREME (regular)', name: 'Supreme Pizza', category: 'Pizza', variants: V(500, 900, 1350) },

  // ---- special pizzas -----------------------------------------------------
  { menuLabel: 'T.B. SPECIAL PIZZA 1180 / 1480', name: 'Tasty Bites Special Pizza', category: 'Pizza', variants: V2(1180, 1480) },
  { menuLabel: 'MALAI BOTI 550 / 990 / 1450', name: 'Malai Boti Pizza', category: 'Pizza', variants: V(550, 990, 1450) },
  { menuLabel: 'NAWABI (shares Malai Boti prices)', name: 'Nawabi Pizza', category: 'Pizza', variants: V(550, 990, 1450), estimated: true },

  // ---- premium pizzas -----------------------------------------------------
  { menuLabel: 'BEHARI KABAB (premium)', name: 'Behari Kabab Pizza', category: 'Pizza', variants: V2(1200, 1600) },
  { menuLabel: 'BONE FIRE (premium)', name: 'Bone Fire Pizza', category: 'Pizza', variants: V2(1200, 1600) },
  { menuLabel: 'CROWN CRUST (premium)', name: 'Crown Crust Pizza', category: 'Pizza', variants: V2(1200, 1600) },
  { menuLabel: 'LASANIA (premium)', name: 'Lasania Pizza', category: 'Pizza', variants: V2(1200, 1600) },
  { menuLabel: 'CHEESE CRUST (premium)', name: 'Cheese Crust Pizza', category: 'Pizza', variants: V2(1200, 1600) },

  // ---- special starters ---------------------------------------------------
  { menuLabel: 'PIZZA PARATHA 550', name: 'Pizza Paratha', category: 'Starters', price: 550 },
  { menuLabel: 'PASTA 400', name: 'Pasta', category: 'Pasta', price: 400 },

  // ---- broasters ----------------------------------------------------------
  { menuLabel: 'T.B. FISH 1300 / 1 KG', name: 'T.B. Fish', category: 'Broasters', price: 1300, description: 'Broasted fish. Price is per kilogram.' },
  { menuLabel: 'T.B. CHICKEN PIECE 150', name: 'T.B. Chicken Piece', category: 'Broasters', price: 150 },
  { menuLabel: 'CHICKEN PIECE (LEG) 320', name: 'Chicken Piece (Leg)', category: 'Broasters', price: 320 },
  { menuLabel: 'CHICKEN PIECE (CHEST) 360', name: 'Chicken Piece (Chest)', category: 'Broasters', price: 360 },
];

/** Drinks are not priced on either photographed menu page. */
const DRINK = { REGULAR: 150, LITRE: 200, HALF_LITRE: 150, LITRE_1_5: 280 };
export const DRINK_PRICES = DRINK;

/**
 * Every line references a real product by name so the API can resolve it to
 * an ObjectId. `unitPrice` is what one unit costs on its own — the API
 * derives compareAtPrice from it.
 *
 * Pizzas are not flavoured on the board ("1 SMALL PIZZA"), so they are wired
 * to Chicken Tikka Pizza as the stand-in.
 */
export const DEALS = [
  // ---- printed board: Deal 1-7 + Winter Deal -----------------------------
  {
    name: 'Deal 1', badge: 'Menu Deal', price: 550,
    description: '1 zinger, 1 regular fries and 1 regular cold drink.',
    items: [
      { product: 'Zinger Burger', qty: 1, unitPrice: 330 },
      { product: 'Plain Fries', qty: 1, unitPrice: 150 },
      { product: 'Soft Drink Can', qty: 1, unitPrice: DRINK.REGULAR },
    ],
  },
  {
    name: 'Deal 2', badge: 'Menu Deal', price: 999,
    description: '2 zingers, 2 chicken pieces and a half litre drink.',
    items: [
      { product: 'Zinger Burger', qty: 2, unitPrice: 330 },
      { product: 'T.B. Chicken Piece', qty: 2, unitPrice: 150 },
      { product: 'Soft Drink Can', qty: 1, unitPrice: DRINK.HALF_LITRE },
    ],
  },
  {
    name: 'Deal 3', badge: 'Menu Deal', price: 1750,
    description: '4 zingers, 5 nuggets and a 1.5 litre drink.',
    items: [
      { product: 'Zinger Burger', qty: 4, unitPrice: 330 },
      { product: 'Chicken Nuggets 5pc', qty: 1, unitPrice: 280 },
      { product: 'Soft Drink Can', qty: 1, unitPrice: DRINK.LITRE_1_5 },
    ],
  },
  {
    name: 'Deal 4', badge: 'Menu Deal', price: 550,
    description: '1 small pizza and 1 regular drink.',
    items: [
      { product: 'Chicken Tikka Pizza', qty: 1, unitPrice: 500 },
      { product: 'Soft Drink Can', qty: 1, unitPrice: DRINK.REGULAR },
    ],
  },
  {
    name: 'Deal 5', badge: 'Menu Deal', price: 1249,
    description: '1 small pizza, 2 zinger burgers and a 1 litre drink.',
    items: [
      { product: 'Chicken Tikka Pizza', qty: 1, unitPrice: 500 },
      { product: 'Zinger Burger', qty: 2, unitPrice: 330 },
      { product: 'Soft Drink Can', qty: 1, unitPrice: DRINK.LITRE },
    ],
  },
  {
    name: 'Deal 6', badge: 'Menu Deal', price: 1449,
    description: '1 large pizza and a 1.5 litre drink.',
    items: [
      { product: 'Chicken Tikka Pizza', qty: 1, unitPrice: 1350 },
      { product: 'Soft Drink Can', qty: 1, unitPrice: DRINK.LITRE_1_5 },
    ],
  },
  {
    name: 'Deal 7', badge: 'Menu Deal', price: 1799,
    description: '1 medium pizza, 10 hot wings, 1 large fries and a 1 litre drink.',
    items: [
      { product: 'Chicken Tikka Pizza', qty: 1, unitPrice: 900 },
      { product: 'Hot Wings', qty: 1, unitPrice: 550 },
      { product: 'Plain Fries', qty: 1, unitPrice: 320 },
      { product: 'Soft Drink Can', qty: 1, unitPrice: DRINK.LITRE },
    ],
  },
  {
    name: 'Winter Deal', badge: 'Menu Deal', price: 1400,
    description: '1 kg broasted fish and a 1 litre drink.',
    items: [
      { product: 'T.B. Fish', qty: 1, unitPrice: 1300 },
      { product: 'Soft Drink Can', qty: 1, unitPrice: DRINK.LITRE },
    ],
  },

  // ---- promo posters ------------------------------------------------------
  {
    name: 'Daily Deal: 12 Hot Shots', badge: 'Daily Deal', price: 250,
    image: 'deal-12-hot-shots.jpg',
    description: '12 hot shots, only Rs. 250.',
    items: [{ product: 'Hot Shots 12pc', qty: 1, unitPrice: 500 }],
  },
  {
    name: 'Daily Deal: Large Pizza + 5 Hot Wings', badge: 'Daily Deal', price: 1499,
    image: 'deal-large-pizza-5-wings.jpg',
    description: '1 large pizza and 5 hot wings.',
    items: [
      { product: 'Chicken Tikka Pizza', qty: 1, unitPrice: 1350 },
      { product: 'Hot Wings', qty: 1, unitPrice: 300 },
    ],
  },
  {
    name: 'Daily Deal: Small Pizza + 10 Hot Shots + 1L', badge: 'Daily Deal', price: 790,
    image: 'deal-small-pizza-10-hotshots.jpg',
    description: '1 small pizza, 10 hot shots and a 1 litre drink.',
    items: [
      { product: 'Chicken Tikka Pizza', qty: 1, unitPrice: 500 },
      { product: 'Hot Shots 10pc', qty: 1, unitPrice: 420 },
      { product: 'Soft Drink Can', qty: 1, unitPrice: DRINK.LITRE },
    ],
  },
  {
    name: 'Daily Deal: Large Pizza + 12 Hot Shots + 1L', badge: 'Daily Deal', price: 1499,
    image: 'deal-large-pizza-12-hotshots.jpg',
    description: '1 large pizza, 12 hot shots and a 1 litre drink.',
    items: [
      { product: 'Chicken Tikka Pizza', qty: 1, unitPrice: 1350 },
      { product: 'Hot Shots 12pc', qty: 1, unitPrice: 500 },
      { product: 'Soft Drink Can', qty: 1, unitPrice: DRINK.LITRE },
    ],
  },
  {
    name: 'Daily Deal: 2 Small Pizzas + 1L', badge: 'Daily Deal', price: 999,
    image: 'deal-2-small-pizzas.jpg',
    description: '2 small pizzas and a 1 litre drink.',
    items: [
      { product: 'Chicken Tikka Pizza', qty: 2, unitPrice: 500 },
      { product: 'Soft Drink Can', qty: 1, unitPrice: DRINK.LITRE },
    ],
  },
  {
    name: 'Daily Deal: 3 Zinger Burgers + 1L', badge: 'Daily Deal', price: 999,
    image: 'deal-3-zingers.jpg',
    description: '3 zinger burgers and a 1 litre drink.',
    items: [
      { product: 'Zinger Burger', qty: 3, unitPrice: 330 },
      { product: 'Soft Drink Can', qty: 1, unitPrice: DRINK.LITRE },
    ],
  },
  {
    name: 'Daily Deal: 4 Zinger Burgers + 1L', badge: 'Daily Deal', price: 1199,
    image: 'deal-4-zingers.jpg',
    description: '4 zinger burgers and a 1 litre drink.',
    items: [
      { product: 'Zinger Burger', qty: 4, unitPrice: 330 },
      { product: 'Soft Drink Can', qty: 1, unitPrice: DRINK.LITRE },
    ],
  },
  {
    name: 'Daily Deal: 2 Zinger Burgers + 1L', badge: 'Daily Deal', price: 700,
    image: 'deal-2-zingers.jpg',
    description: '2 zinger burgers and a 1 litre drink.',
    items: [
      { product: 'Zinger Burger', qty: 2, unitPrice: 330 },
      { product: 'Soft Drink Can', qty: 1, unitPrice: DRINK.LITRE },
    ],
  },
  {
    name: 'Daily Deal: Medium Pizza Combo', badge: 'Daily Deal', price: 1350,
    image: 'deal-medium-pizza-combo.jpg',
    description: '1 medium pizza, medium fries, 5 nuggets and a 1 litre drink.',
    items: [
      { product: 'Chicken Tikka Pizza', qty: 1, unitPrice: 900 },
      { product: 'Plain Fries', qty: 1, unitPrice: 220 },
      { product: 'Chicken Nuggets 5pc', qty: 1, unitPrice: 280 },
      { product: 'Soft Drink Can', qty: 1, unitPrice: DRINK.LITRE },
    ],
  },
  {
    name: 'Daily Deal: Large Pizza + 5 Nuggets + 1L', badge: 'Daily Deal', price: 1399,
    image: 'deal-large-pizza-nuggets.jpg',
    description: '1 large pizza, 5 nuggets and a 1 litre drink.',
    items: [
      { product: 'Chicken Tikka Pizza', qty: 1, unitPrice: 1350 },
      { product: 'Chicken Nuggets 5pc', qty: 1, unitPrice: 280 },
      { product: 'Soft Drink Can', qty: 1, unitPrice: DRINK.LITRE },
    ],
  },
  {
    name: 'Daily Deal: Small Pizza + Zinger + 2 Drinks', badge: 'Daily Deal', price: 890,
    image: 'deal-small-pizza-zinger.jpg',
    description: '1 small pizza, 1 zinger and 2 drinks.',
    items: [
      { product: 'Chicken Tikka Pizza', qty: 1, unitPrice: 500 },
      { product: 'Zinger Burger', qty: 1, unitPrice: 330 },
      { product: 'Soft Drink Can', qty: 2, unitPrice: DRINK.REGULAR },
    ],
  },
];

/** Deal images are served from the same folder as the posters. */
export const dealImageUrl = (d) => (d.image ? IMAGE_BASE + d.image : '');
