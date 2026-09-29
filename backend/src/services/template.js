/**
 * Renders campaign message templates.
 *
 * Two kinds of placeholder:
 *
 *   {{name}}                  a value, replaced once
 *   {{spin:Hi|Hey|Hello}}     pick one of the options
 *
 * Spins are seeded from the customer's phone number, not Math.random(). If a
 * worker restarts, or a send is retried, the same person still gets the same
 * greeting. Re-rolling the wording on every attempt is exactly the sort of
 * inconsistency that makes an account look automated.
 */

const KNOWN_TOKENS = [
  'name',
  'fullName',
  'area',
  'deal',
  'dealPrice',
  'dealSaving',
  'shopName',
  'link',
  'dealLink',
];

const TOKEN_RE = /\{\{\s*([a-zA-Z]+)\s*\}\}/g;
const SPIN_RE = /\{\{\s*spin\s*:\s*([^}]+?)\s*\}\}/g;

/** FNV-1a. Small, fast, and identical on every run and every machine. */
function hashSeed(value) {
  let hash = 2166136261;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Seeded generator, so a template with several spins varies but stays stable. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function firstName(full) {
  return String(full || '').trim().split(/\s+/)[0] || '';
}

function savingText(deal) {
  if (!deal) return '';
  const price = Number(deal.price);
  const compareAt = Number(deal.compareAtPrice);
  if (!(price > 0) || !(compareAt > price)) return '';
  const saved = Math.round((compareAt - price) * 100) / 100;
  const percent = Math.round((saved / compareAt) * 100);
  return `Save Rs ${saved} (${percent}%)`;
}

function storefrontBase() {
  const configured = process.env.STOREFRONT_URL || process.env.CLIENT_ORIGIN || '';
  return String(configured).split(',')[0].trim().replace(/\/$/, '');
}

function buildValues(contact, deal, shop) {
  const base = storefrontBase();
  return {
    name: firstName(contact?.name) || 'there',
    fullName: contact?.name || '',
    area: contact?.area || contact?.lastKnownArea || '',
    deal: deal?.name || '',
    dealPrice: deal?.price != null ? `Rs ${deal.price}` : '',
    dealSaving: savingText(deal),
    shopName: shop?.shopName || '',
    link: base,
    dealLink: base && deal?.slug ? `${base}/deals/${deal.slug}` : base,
  };
}

/**
 * Cleans up the holes left by an empty token. A customer with no area should not
 * receive "we deliver in , just today".
 */
function tidy(text) {
  return String(text)
    .replace(/[ \t]+([,.!?;:])/g, '$1')
    .replace(/([,.!?;:])\1+/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function renderTemplate(template, { contact, deal, shop } = {}) {
  const seed = contact?.phone || '';
  const rand = mulberry32(hashSeed(seed));
  const values = buildValues(contact, deal, shop);

  const withSpins = String(template || '').replace(SPIN_RE, (_match, body) => {
    const options = body
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean);
    if (!options.length) return '';
    return options[Math.floor(rand() * options.length)];
  });

  return tidy(withSpins.replace(TOKEN_RE, (_match, key) => values[key] ?? ''));
}

/**
 * Reports unknown `{{tokens}}` so the admin gets an error instead of sending a
 * message with a blank hole in it.
 */
export function validateTemplate(template) {
  const problems = [];

  for (const match of String(template || '').matchAll(TOKEN_RE)) {
    const key = match[1];
    if (!KNOWN_TOKENS.includes(key)) problems.push(`Unknown token {{${key}}}`);
  }

  for (const match of String(template || '').matchAll(SPIN_RE)) {
    const options = match[1].split('|').filter((part) => part.trim());
    if (options.length < 2) problems.push('A spin needs at least two options, e.g. {{spin:Hi|Hey}}');
  }

  if (!String(template || '').trim()) problems.push('The message is empty');

  return [...new Set(problems)];
}

/**
 * Renders the same template against several customers, so the admin can see the
 * variation that will actually go out rather than guessing at it.
 */
export function renderSamples(template, contacts, { deal, shop } = {}) {
  return contacts.map((contact) => ({
    phone: contact.phone,
    name: contact.name,
    text: renderTemplate(template, { contact, deal, shop }),
  }));
}

/** How many distinct wordings a template can produce, for the admin screen. */
export function variationCount(template) {
  const spins = [...String(template || '').matchAll(SPIN_RE)];
  if (!spins.length) return 1;
  return spins.reduce((total, match) => total * match[1].split('|').filter((p) => p.trim()).length, 1);
}
