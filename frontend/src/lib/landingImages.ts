/**
 * Every image the landing page uses lives in `frontend/public/img/landing/` and
 * is referenced through this file — nothing hardcodes a path in a component.
 *
 * To swap in the real photography later: drop your files into
 * `frontend/public/img/landing/` and change the value here. No component edits.
 *
 * Current files are Pexels stock photos (Pexels licence, free for commercial
 * use, no attribution required) standing in until real cafe photos exist.
 */
export const landingImages = {
  hero: '/img/landing/hero-burger.jpg',
  heroSecondary: '/img/landing/tray.jpg',
  delivery: '/img/landing/fries.jpg',
} as const;

/**
 * Picks a category photo by matching words in the category name. Anything we
 * have no photo for falls back to a tinted block in the component, so a new
 * category added in the admin panel still renders cleanly.
 */
const CATEGORY_MATCHES: [RegExp, keyof typeof landingImages | string][] = [
  [/burger/i, '/img/landing/burger.jpg'],
  [/pizza/i, '/img/landing/pizza.jpg'],
  [/chicken|wing|nugget|fried/i, '/img/landing/chicken.jpg'],
  [/roll|wrap|shawarma/i, '/img/landing/tray.jpg'],
  [/fries|side|snack/i, '/img/landing/fries.jpg'],
  [/pasta/i, '/img/landing/pasta.jpg'],
  [/shake|juice|drink|coffee|tea/i, '/img/landing/shake.jpg'],
  [/dessert|sweet|kunafa|cake/i, '/img/landing/shake.jpg'],
  [/deal|bundle|combo/i, '/img/landing/hero-burger.jpg'],
];

export function categoryImage(name: string): string | undefined {
  for (const [pattern, file] of CATEGORY_MATCHES) {
    if (pattern.test(name)) return file;
  }
  return undefined;
}
