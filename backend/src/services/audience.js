import Contact from '../models/Contact.js';
import SendJob from '../models/SendJob.js';

/**
 * Chooses who a campaign may message.
 *
 * Two rules are enforced here rather than at send time, so an opted-out customer
 * cannot slip through by a job having been queued before they opted out:
 *
 *  1. Only contactable contacts. Anyone who opted out permanently, or who
 *     tapped "not now", is excluded until that pause has passed.
 *
 *  2. Nobody twice. A contact already in this campaign is never returned again,
 *     so re-running a campaign cannot send a customer a second opener.
 *
 * The count itself comes from the admin. There is no automatic ramp here.
 */

/** Matches the Contact.isContactable virtual, which cannot be used in a query. */
function contactableFilter(now = new Date()) {
  return {
    optOut: false,
    $or: [
      { doNotContactUntil: null },
      { doNotContactUntil: { $exists: false } },
      { doNotContactUntil: { $lte: now } },
    ],
  };
}

/**
 * Picks the recipients for a campaign.
 *
 * Ordered by most recent order first, so the warmest relationships are asked
 * before the long-tail. `limit` of 0 means everyone who is contactable.
 */
export async function selectRecipients(campaign, { limit } = {}) {
  const cap = Number.isInteger(limit) ? limit : Number(campaign.recipientLimit) || 0;

  const alreadyQueued = await SendJob.distinct('contact', { campaign: campaign._id });

  const query = { ...contactableFilter(), _id: { $nin: alreadyQueued } };

  const cursor = Contact.find(query)
    .sort({ lastOrderAt: -1, createdAt: -1 })
    .select('name phone area lastKnownArea lastOrderAt orderCount totalSpent')
    .lean({ virtuals: true });

  if (cap > 0) cursor.limit(cap);

  return cursor;
}

/**
 * Counts for the admin screen before anything is queued: how many are eligible,
 * how many are already in the campaign, and how many this campaign will send.
 */
export async function describeAudience(campaign) {
  const now = new Date();
  const [eligible, alreadyQueued] = await Promise.all([
    Contact.countDocuments(contactableFilter(now)),
    SendJob.countDocuments({ campaign: campaign._id }),
  ]);

  const cap = Number(campaign.recipientLimit) || 0;
  const remaining = Math.max(0, eligible - alreadyQueued);

  return {
    eligible,
    alreadyQueued,
    recipientLimit: cap,
    willSend: cap > 0 ? Math.min(cap, remaining) : remaining,
    // when the chosen number is bigger than the eligible list, say so plainly
    exceedsList: cap > remaining,
  };
}
