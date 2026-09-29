import Campaign from '../models/Campaign.js';
import SendJob from '../models/SendJob.js';
import Deal from '../models/Deal.js';
import { getSettings } from '../models/Setting.js';
import { selectRecipients, describeAudience } from './audience.js';
import { renderTemplate, renderSamples, validateTemplate, variationCount } from './template.js';
import { logMessage } from './whatsappLog.js';

/**
 * Turning a campaign into queued jobs.
 *
 * The opener is rendered once, here, and stored on the job. From that moment the
 * text is fixed, so a retry or a worker restart re-sends the identical wording
 * instead of producing a new variant halfway through a campaign.
 */

export async function queueOpeners(campaign, { limit } = {}) {
  const shop = await getSettings();
  const deal = campaign.deal ? await Deal.findById(campaign.deal).lean() : null;

  const contacts = await selectRecipients(campaign, { limit });
  if (!contacts.length) return { queued: 0, duplicates: 0, reason: 'no contactable contacts left' };

  const buttons = (campaign.options || []).map((option) => option.label);

  const docs = contacts.map((contact) => ({
    campaign: campaign._id,
    contact: contact._id,
    phone: contact.phone,
    stage: 'opener',
    status: 'queued',
    variant: renderTemplate(campaign.openerTemplate, { contact, deal, shop }),
    buttons,
  }));

  // ordered:false so one duplicate does not abandon the rest of the batch
  const result = await SendJob.insertMany(docs, { ordered: false });

  // mongoose returns the inserted documents, while the raw driver result would
  // carry insertedCount. handle both so the count is never undefined.
  const inserted = Array.isArray(result) ? result.length : result?.insertedCount ?? 0;

  const recipients = await SendJob.countDocuments({ campaign: campaign._id });
  await Campaign.updateOne({ _id: campaign._id }, { $set: { 'stats.recipients': recipients } });

  return { queued: inserted, duplicates: docs.length - inserted };
}

/** What the admin screen shows before anything is queued. */
export async function previewCampaign(campaign, sampleSize = 3) {
  const shop = await getSettings();
  const deal = campaign.deal ? await Deal.findById(campaign.deal).lean() : null;

  const audience = await describeAudience(campaign);
  const samples = await selectRecipients(campaign, { limit: sampleSize });

  return {
    audience,
    openerProblems: validateTemplate(campaign.openerTemplate),
    dealProblems: validateTemplate(campaign.dealTemplate),
    openerVariations: variationCount(campaign.openerTemplate),
    dealVariations: variationCount(campaign.dealTemplate),
    openerSamples: renderSamples(campaign.openerTemplate, samples, { deal, shop }),
    dealSamples: renderSamples(campaign.dealTemplate, samples, { deal, shop }),
    deal: deal ? { name: deal.name, price: deal.price, image: deal.image } : null,
  };
}

/** Records an outbound message against the history. */
export async function logOutbound(job, { error = '' } = {}) {
  await logMessage({
    campaign: job.campaign,
    job: job._id,
    contact: job.contact,
    phone: job.phone,
    direction: 'out',
    stage: job.stage,
    kind: error ? 'error' : `${job.stage}_sent`,
    body: job.variant,
    imageUrl: job.imageUrl,
    error,
  });
}

export { Campaign, SendJob };
