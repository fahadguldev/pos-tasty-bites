import Campaign from '../models/Campaign.js';
import Contact from '../models/Contact.js';
import SendJob from '../models/SendJob.js';
import Deal from '../models/Deal.js';
import { getSettings } from '../models/Setting.js';
import { normalisePhone, isValidPkPhone } from '../utils/format.js';
import { renderTemplate } from './template.js';
import { logMessage } from './whatsappLog.js';

/**
 * Turns a customer's reply into an action.
 *
 * The order of checks matters. "Stop" is always looked at first, so a customer
 * can always get out regardless of what else they said.
 *
 * Permanent opt-out needs an explicit word. A bare "no" is treated as "not now",
 * because mistaking a polite refusal for a permanent block would silence a real
 * customer over one bad interaction.
 */

const STOP_WORDS = ['stop', 'unsubscribe', 'remove me', 'remove', 'end', 'quit', 'leave', 'stop messaging'];
const SNOOZE_WORDS = ['no', 'not now', 'later', 'busy', 'not interested', 'no thanks', 'not right now', 'maybe later'];
const YES_WORDS = ['yes', 'yeah', 'yep', 'y', 'sure', 'ok', 'okay', 'interested', 'send it', 'send', 'please', 'tell me', 'details'];

function normalise(text) {
  return String(text || '').trim().toLowerCase().replace(/[!.,?]+$/, '');
}

function matchesAny(text, words) {
  return words.some((word) => text === word || text.startsWith(`${word} `));
}

/**
 * Works out what a reply means. A tapped button is unambiguous, so it wins over
 * guessing from the text. Exported separately so it can be tested on its own.
 */
export function classifyReply({ text = '', buttonId = '', options = [] } = {}) {
  const tapped = options.find((option) => option.id === buttonId || normalise(option.label) === normalise(buttonId));
  if (tapped) return { action: tapped.action, option: tapped };

  const reply = normalise(text);
  if (!reply) return { action: 'ignore' };

  if (matchesAny(reply, STOP_WORDS)) return { action: 'stop' };
  if (matchesAny(reply, SNOOZE_WORDS)) return { action: 'snooze' };
  if (matchesAny(reply, YES_WORDS)) return { action: 'send_deal' };

  // a customer typing their own question is a good sign, so offer the deal
  if (/\?$/.test(reply)) return { action: 'send_deal' };

  return { action: 'ignore' };
}

/**
 * Handles one inbound message. Safe to call for any number, including strangers
 * and numbers that are not on the contact list.
 */
export async function handleInbound({ from, text = '', buttonId = '' }) {
  const phone = normalisePhone(from);
  if (!isValidPkPhone(phone)) return { action: 'ignored', reason: 'not a valid number' };

  const contact = await Contact.findOne({ phone });
  if (!contact) return { action: 'ignored', reason: 'not on the contact list' };

  // the most recent opener this customer was actually sent. 'replied' is
  // included so a second "yes" is recognised and ignored rather than slipping
  // through as an unknown message.
  const opener = await SendJob.findOne({
    phone,
    stage: 'opener',
    status: { $in: ['sent', 'replied'] },
  }).sort({ sentAt: -1 });
  if (!opener) return { action: 'ignored', reason: 'no message was sent to this contact' };

  const campaign = await Campaign.findById(opener.campaign);
  if (!campaign) return { action: 'ignored', reason: 'campaign no longer exists' };

  const { action, option } = classifyReply({ text, buttonId, options: campaign.options || [] });

  if (action === 'stop') {
    contact.optOut = true;
    contact.optedOutAt = new Date();
    contact.doNotContactUntil = null;
    await contact.save();

    opener.status = 'cancelled';
    opener.replyText = String(text || '').slice(0, 300);
    await opener.save();

    await Campaign.updateOne({ _id: campaign._id }, { $inc: { 'stats.optedOut': 1 } });
    await logMessage({ campaign: campaign._id, phone, direction: 'in', body: text || buttonId, kind: 'stop' });
    return { action: 'stopped', phone };
  }

  if (action === 'snooze') {
    const days = option?.snoozeDays || 30;
    contact.doNotContactUntil = new Date(Date.now() + days * 86400000);
    await contact.save();

    opener.status = 'skipped';
    opener.replyText = String(text || '').slice(0, 300);
    await opener.save();

    await Campaign.updateOne({ _id: campaign._id }, { $inc: { 'stats.snoozed': 1 } });
    await logMessage({ campaign: campaign._id, phone, direction: 'in', body: text || buttonId, kind: 'snooze' });
    return { action: 'snoozed', phone, days };
  }

  if (action === 'send_deal') {
    // the customer asked for it, so this is the only path that ever creates a
    // deal message. There is no code that sends a deal unprompted.
    const shop = await getSettings();
    const deal = campaign.deal ? await Deal.findById(campaign.deal).lean() : null;

    opener.status = 'replied';
    opener.repliedAt = new Date();
    opener.qualifiedAt = new Date();
    opener.replyText = String(text || '').slice(0, 300);
    await opener.save();

    const alreadyQueued = await SendJob.exists({
      campaign: campaign._id,
      contact: contact._id,
      stage: 'deal',
    });

    if (alreadyQueued) return { action: 'already_queued', phone };

    await SendJob.create({
      campaign: campaign._id,
      contact: contact._id,
      phone,
      stage: 'deal',
      status: 'queued',
      variant: renderTemplate(campaign.dealTemplate, { contact, deal, shop }),
      imageUrl: campaign.sendImage ? deal?.image || '' : '',
    });

    contact.qualifiedAt = new Date();
    await contact.save();

    await Campaign.updateOne({ _id: campaign._id }, { $inc: { 'stats.qualified': 1 } });
    await logMessage({ campaign: campaign._id, phone, direction: 'in', body: text || buttonId, kind: 'qualified' });

    return { action: 'deal_queued', phone };
  }

  await logMessage({ campaign: campaign._id, phone, direction: 'in', body: text, kind: 'ignored' });
  return { action: 'ignored', reason: 'no action matched the reply' };
}
