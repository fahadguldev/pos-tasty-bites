import type { Deal, Product } from './types';

/**
 * Placeholder photography for the storefront, used only when a product has no
 * photo of its own.
 *
 * Order of precedence:
 *   1. the real image stored on the product (uploaded through Cloudinary, saved
 *      in the database) — always wins
 *   2. a category-appropriate stock photo picked by matching the product name
 *   3. a category photo from the product's category
 *   4. nothing, in which case the card renders its own tinted block
 *
 * The files live in `frontend/public/img/products/`. Once the real menu is
 * photographed, upload the images in the admin panel and these stop being used —
 * no code change needed, because rule 1 short-circuits the rest.
 *
 * Selection is a hash of the product name, not a counter, so the same product
 * always resolves to the same photo across reloads and across the menu, product
 * page, cart and deal screens.
 */

type Basket = string[];

/** ordered most-specific first — a name match beats a category match */
const BY_NAME: [RegExp, Basket][] = [
  [/pizza/i, ['pizza-1', 'pizza-2', 'pizza-3']],
  [/sundae|cheesecake|kunafa|dessert/i, ['dessert-1', 'dessert-2']],
  [/lasagna|pasta|arrabiata|behari/i, ['pasta-1', 'pasta-2', 'pasta-3']],
  [/fries|loaded fries/i, ['fries-1', 'fries-2', 'fries-3']],
  [/roll|wrap|shawarma|twister/i, ['wrap-1', 'wrap-2']],
  [/nugget/i, ['chicken-1', 'chicken-4']],
  [/wing|hot shot/i, ['chicken-2', 'chicken-3', 'chicken-4']],
  [/burger|zinger|patty/i, ['burger-1', 'burger-2', 'burger-3', 'burger-4']],
  [/shake/i, ['shake-1', 'shake-2', 'shake-3']],
  [/falsa|juice|lime/i, ['shake-2', 'shake-3']],
  [/coffee|tea/i, ['shake-1', 'shake-2']],
  [/water|drink|can|cola/i, ['shake-3']],
];

const BY_CATEGORY: [RegExp, Basket][] = [
  [/pizza/i, ['pizza-1', 'pizza-2']],
  [/dessert|sweet/i, ['dessert-1', 'dessert-2']],
  [/pasta/i, ['pasta-1', 'pasta-2']],
  [/fries|side|snack/i, ['fries-1', 'fries-3']],
  [/roll|wrap/i, ['wrap-1', 'wrap-2']],
  [/chicken|fried/i, ['chicken-1', 'chicken-2']],
  [/drink/i, ['shake-3']],
  [/shake|juice/i, ['shake-1', 'shake-2']],
  [/burger/i, ['burger-1', 'burger-2']],
];

/** stable string hash, so a product's photo never changes between renders */
function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h << 5) - h + value.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

const url = (file: string) => `/img/products/${file}.jpg`;

function pick(basket: Basket, seed: string): string {
  return url(basket[hash(seed) % basket.length]);
}

/** placeholder for anything that only has a name to go on (cart lines, deals) */
export function fallbackForName(name?: string): string | undefined {
  if (!name) return undefined;
  for (const [pattern, basket] of BY_NAME) {
    if (pattern.test(name)) return pick(basket, name);
  }
  return undefined;
}

/** the product's own photo if it has one, otherwise a matching placeholder */
export function productImage(product: Pick<Product, 'name' | 'images' | 'category'>): string | undefined {
  const own = product.images?.[0]?.url;
  if (own) return own;

  const seed = product.name || 'item';
  const byName = fallbackForName(seed);
  if (byName) return byName;

  const categoryName = typeof product.category === 'string' ? product.category : product.category?.name;
  if (categoryName) {
    for (const [pattern, basket] of BY_CATEGORY) {
      if (pattern.test(categoryName)) return pick(basket, categoryName);
    }
  }

  return undefined;
}

/**
 * A deal has no photo of its own, so it borrows the placeholder for the first
 * product it contains — a bundle of burgers should look like a bundle of
 * burgers.
 */
export function dealImage(deal: Pick<Deal, 'name' | 'image' | 'items'>): string | undefined {
  if (deal.image) return deal.image;

  const first = deal.items?.[0];
  if (!first) return fallbackForName(deal.name);

  const name = typeof first.product === 'object' && first.product ? first.product.name : first.name;
  return fallbackForName(name) ?? pick(['burger-1', 'pizza-1', 'chicken-1'], deal.name);
}
