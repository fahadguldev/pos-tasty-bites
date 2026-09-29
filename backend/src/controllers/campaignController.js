import Campaign from '../models/Campaign.js';
import SendJob from '../models/SendJob.js';
import MessageLog from '../models/MessageLog.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validateTemplate } from '../services/template.js';
import { previewCampaign, queueOpeners } from '../services/campaign.js';
import { describeAudience } from '../services/audience.js';
import { pendingCount } from '../services/sending.js';

/** whatsapp web shows at most three quick-reply buttons on a message */
const MAX_OPTIONS = 3;

function templateProblem(template, label) {
  const problems = validateTemplate(template);
  return problems.length ? `${label}: ${problems.join(', ')}` : '';
}

function readOptions(raw) {
  if (!Array.isArray(raw) || !raw.length) return [];
  if (raw.length > MAX_OPTIONS) throw Object.assign(new Error(`A message can carry at most ${MAX_OPTIONS} quick-reply buttons`), { status: 400 });

  return raw.map((option) => ({
    id: String(option.id || option.label || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    label: String(option.label || '').trim().slice(0, 40),
    action: option.action,
    snoozeDays: Number(option.snoozeDays) || 30,
  })).filter((option) => option.id && option.label && option.action);
}

function applyInput(campaign, body) {
  const {
    name, deal, openerTemplate, dealTemplate, options,
    recipientLimit, gap, sendImage,
  } = body;

  if (name !== undefined) campaign.name = String(name).trim();
  if (deal !== undefined) campaign.deal = deal || null;
  if (sendImage !== undefined) campaign.sendImage = Boolean(sendImage);
  if (recipientLimit !== undefined) campaign.recipientLimit = Math.max(0, Number(recipientLimit) || 0);
  if (options !== undefined) campaign.options = readOptions(options);

  if (gap !== undefined) {
    const min = Math.max(0, Number(gap?.minSeconds ?? campaign.gap.minSeconds));
    const max = Math.max(min, Number(gap?.maxSeconds ?? campaign.gap.maxSeconds));
    campaign.gap = { minSeconds: min, maxSeconds: max };
  }

  if (openerTemplate !== undefined) campaign.openerTemplate = String(openerTemplate);
  if (dealTemplate !== undefined) campaign.dealTemplate = String(dealTemplate);
}

export const list = asyncHandler(async (req, res) => {
  const campaigns = await Campaign.find().sort({ createdAt: -1 }).lean({ virtuals: true });
  res.json(campaigns);
});

export const getOne = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findById(req.params.id).lean({ virtuals: true });
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  res.json({
    ...campaign,
    audience: await describeAudience(campaign),
    pending: await pendingCount(campaign._id),
  });
});

/** Renders the message against real customers without queueing anything. */
export const preview = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findById(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  res.json(await previewCampaign(campaign));
});

export const create = asyncHandler(async (req, res) => {
  const { name, openerTemplate, dealTemplate } = req.body;

  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Give the campaign a name' });

  const problem = templateProblem(openerTemplate, 'Opening message') || templateProblem(dealTemplate, 'Deal message');
  if (problem) return res.status(400).json({ error: problem });

  const campaign = new Campaign({ name: String(name).trim(), openerTemplate, dealTemplate });
  try {
    applyInput(campaign, req.body);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }

  await campaign.save();
  res.status(201).json(campaign.toJSON());
});

export const update = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findById(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  if (campaign.status === 'running') {
    return res.status(409).json({ error: 'Pause the campaign before changing the message' });
  }

  const problem =
    templateProblem(req.body.openerTemplate, 'Opening message') ||
    templateProblem(req.body.dealTemplate, 'Deal message');
  if (problem) return res.status(400).json({ error: problem });

  try {
    applyInput(campaign, req.body);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }

  await campaign.save();
  res.json(campaign.toJSON());
});

/**
 * Queues the opening question and hands the campaign to the worker.
 *
 * The count is the admin's own number. Nothing here scales it, retries it or
 * decides to send more.
 */
export const start = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findById(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  if (campaign.status === 'running') return res.status(409).json({ error: 'This campaign is already running' });
  if (['completed', 'cancelled'].includes(campaign.status)) {
    return res.status(409).json({ error: `A ${campaign.status} campaign cannot be started again` });
  }

  const problem = templateProblem(campaign.openerTemplate, 'Opening message');
  if (problem) return res.status(400).json({ error: problem });

  const audience = await describeAudience(campaign);
  if (audience.willSend === 0) {
    return res.status(400).json({ error: 'There are no contactable customers left to message' });
  }

  const limit = req.body?.limit != null ? Math.max(0, Number(req.body.limit) || 0) : undefined;
  const result = await queueOpeners(campaign, { limit });

  campaign.status = 'running';
  campaign.startedAt = campaign.startedAt || new Date();
  campaign.pausedAt = null;
  await campaign.save();

  res.json({ queued: result.queued, duplicates: result.duplicates, reason: result.reason || '', campaign: campaign.toJSON() });
});

export const pause = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findByIdAndUpdate(
    req.params.id,
    { status: 'paused', pausedAt: new Date() },
    { new: true }
  );
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  res.json(campaign.toJSON());
});

export const resume = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findByIdAndUpdate(
    req.params.id,
    { status: 'running', pausedAt: null },
    { new: true }
  );
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  if (campaign.status !== 'running') return res.status(409).json({ error: 'Only a paused campaign can resume' });
  res.json(campaign.toJSON());
});

export const cancel = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findById(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  campaign.status = 'cancelled';
  campaign.completedAt = new Date();
  campaign.cancelReason = String(req.body?.reason || 'cancelled by staff');
  await campaign.save();

  // anything still waiting is cancelled too, so the worker has nothing left to pick up
  const result = await SendJob.updateMany(
    { campaign: campaign._id, status: { $in: ['queued', 'sending'] } },
    { $set: { status: 'cancelled' } }
  );

  res.json({ ...campaign.toJSON(), cancelledJobs: result.modifiedCount });
});

export const messages = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findById(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = 100;

  const query = { campaign: campaign._id };
  if (req.query.phone) query.phone = String(req.query.phone).replace(/\D/g, '');

  const [entries, total] = await Promise.all([
    MessageLog.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    MessageLog.countDocuments(query),
  ]);

  res.json({ entries, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

export const remove = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findById(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  if (campaign.status === 'running') return res.status(409).json({ error: 'Cancel the campaign before deleting it' });

  await SendJob.deleteMany({ campaign: campaign._id });
  await MessageLog.deleteMany({ campaign: campaign._id });
  await campaign.deleteOne();

  res.status(204).end();
});
