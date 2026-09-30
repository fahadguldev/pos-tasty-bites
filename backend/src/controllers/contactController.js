import Contact from '../models/Contact.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { backfillFromOrders } from '../services/contactBackfill.js';
import { normalisePhone, isValidPkPhone, isLikelyDemoPhone } from '../utils/format.js';

const PAGE_SIZE = 50;

/**
 * Rejects numbers that should never become a contact: malformed, or a
 * placeholder from the demo seed. Returns null when the phone is fine.
 */
function phoneProblem(value) {
  const phone = normalisePhone(value);
  if (!isValidPkPhone(phone)) return 'Enter a valid Pakistani mobile number, e.g. 03001234567';
  if (isLikelyDemoPhone(phone)) return 'That number looks like placeholder data, not a real customer';
  return null;
}

export const list = asyncHandler(async (req, res) => {
  const { q, source, filter } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);

  const query = {};

  if (q) {
    const digits = String(q).replace(/\D/g, '');
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const clause = digits
      ? { $or: [{ name: new RegExp(safe, 'i') }, { phone: new RegExp(digits) }, { area: new RegExp(safe, 'i') }] }
      : { $or: [{ name: new RegExp(safe, 'i') }, { area: new RegExp(safe, 'i') }] };
    Object.assign(query, clause);
  }

  if (source) query.source = source;

  if (filter === 'contactable') {
    query.optOut = false;
    query.$or = [
      { doNotContactUntil: null },
      { doNotContactUntil: { $exists: false } },
      { doNotContactUntil: { $lte: new Date() } },
    ];
  } else if (filter === 'optedOut') {
    query.optOut = true;
  }

  const total = await Contact.countDocuments(query);
  const contacts = await Contact.find(query)
    .sort({ lastOrderAt: -1, createdAt: -1 })
    .skip((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .lean({ virtuals: true });

  res.json({
    contacts,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
});

export const getOne = asyncHandler(async (req, res) => {
  const contact = await Contact.findById(req.params.id).lean({ virtuals: true });
  if (!contact) return res.status(404).json({ error: 'Contact not found' });
  res.json(contact);
});

export const create = asyncHandler(async (req, res) => {
  const { name, phone, area, notes, tags, consentSource } = req.body;

  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name is required' });

  const problem = phoneProblem(phone);
  if (problem) return res.status(400).json({ error: problem });

  const normalised = normalisePhone(phone);

  if (await Contact.exists({ phone: normalised })) {
    return res.status(409).json({ error: 'That number is already on the contact list' });
  }

  const contact = await Contact.create({
    name: String(name).trim(),
    phone: normalised,
    area: area || '',
    notes: notes || '',
    tags: Array.isArray(tags) ? tags.filter(Boolean) : [],
    source: 'manual',
    // a manually added contact is contactable on the admin's say-so
    consentSource: consentSource || 'added by staff',
    consentedAt: new Date(),
  });

  res.status(201).json(contact.toJSON());
});

export const update = asyncHandler(async (req, res) => {
  const contact = await Contact.findById(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  const { name, phone, area, notes, tags, optOut, doNotContactUntil, consentSource } = req.body;

  if (name !== undefined) {
    if (!String(name).trim()) return res.status(400).json({ error: 'Name cannot be empty' });
    contact.name = String(name).trim();
  }

  if (phone !== undefined && phone !== contact.phone) {
    const problem = phoneProblem(phone);
    if (problem) return res.status(400).json({ error: problem });
    const normalised = normalisePhone(phone);
    if (await Contact.exists({ phone: normalised, _id: { $ne: contact._id } })) {
      return res.status(409).json({ error: 'That number is already on the contact list' });
    }
    contact.phone = normalised;
  }

  if (area !== undefined) contact.area = area;
  if (notes !== undefined) contact.notes = notes;
  if (tags !== undefined) contact.tags = Array.isArray(tags) ? tags.filter(Boolean) : [];
  if (consentSource !== undefined) contact.consentSource = consentSource;

  if (optOut !== undefined) {
    contact.optOut = Boolean(optOut);
    contact.optedOutAt = contact.optOut ? new Date() : null;
  }

  if (doNotContactUntil !== undefined) {
    contact.doNotContactUntil = doNotContactUntil ? new Date(doNotContactUntil) : null;
  }

  await contact.save();
  res.json(contact.toJSON());
});

export const remove = asyncHandler(async (req, res) => {
  const contact = await Contact.findByIdAndDelete(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });
  res.status(204).end();
});

/**
 * Two-step on purpose. The admin sees exactly which numbers will be created and
 * which are being skipped (and why) before anything is written.
 */
export const backfillPreview = asyncHandler(async (req, res) => {
  const preview = await backfillFromOrders({ dryRun: true });
  res.json({
    scannedOrders: preview.scannedOrders,
    existingContacts: preview.existingContacts,
    toCreate: preview.toCreate,
    toUpdate: preview.toUpdate.map((c) => c.phone),
    skipped: preview.skipped,
  });
});

export const backfillApply = asyncHandler(async (req, res) => {
  const result = await backfillFromOrders({ dryRun: false });
  res.json({
    created: result.created,
    updated: result.updated,
    skipped: result.skipped,
  });
});
