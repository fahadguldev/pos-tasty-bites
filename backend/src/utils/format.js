export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

// normalises 03xx-xxxxxxx, +92 3xx…, 923xx… into 923xxxxxxxxx
export function normalisePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('92')) return digits;
  if (digits.startsWith('0')) return `92${digits.slice(1)}`;
  return digits;
}

export function isValidPkPhone(value) {
  const digits = normalisePhone(value);
  return /^92\d{10}$/.test(digits);
}

/**
 * The demo seed uses placeholder numbers like 923001111111, where a single digit
 * repeats. A real mobile number does not look like that, so the contact backfill
 * skips anything matching — this stops a demo order from silently becoming a
 * broadcast recipient.
 */
export function isLikelyDemoPhone(value) {
  const digits = normalisePhone(value);
  if (!digits) return false;
  return /(\d)\1{4,}/.test(digits);
}

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

// yyyy-mm-dd in local time, never UTC — avoids the off-by-one-day bug
export function toLocalDateString(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
