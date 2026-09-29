import Campaign from '../models/Campaign.js';
import SendJob from '../models/SendJob.js';
import { toLocalDateString } from '../utils/format.js';

/**
 * The send side: claiming a job, pausing between messages, and recording what
 * happened.
 *
 * Nothing here decides who gets messaged or what the message says. Those are
 * the campaign's job. This file only moves one job at a time and reports the
 * result, so a failure is always attributable to a single customer.
 */

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Random pause between two individual messages. */
export function gapMs(gap) {
  const min = Math.max(0, Number(gap?.minSeconds ?? 120)) * 1000;
  const max = Math.max(min, Number(gap?.maxSeconds ?? 300) * 1000);
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Takes the oldest queued job and marks it as in flight.
 *
 * The claim is a single atomic update, so a second worker cannot pick up the
 * same job. `attempts` increments here rather than at send time, so a process
 * killed mid-send still counts against the retry limit.
 */
export async function claimNextJob(campaignId) {
  return SendJob.findOneAndUpdate(
    { campaign: campaignId, status: 'queued' },
    { $set: { status: 'sending' }, $inc: { attempts: 1 } },
    { new: true, sort: { createdAt: 1 } }
  );
}

async function bumpStat(campaignId, field, amount = 1) {
  await Campaign.updateOne({ _id: campaignId }, { $inc: { [`stats.${field}`]: amount } });
}

async function recordDailyStat(campaignId, dayKey, field, amount = 1) {
  await Campaign.updateOne(
    { _id: campaignId, 'dailyStats.dayKey': dayKey },
    { $inc: { [`dailyStats.$.${field}`]: amount } }
  );

  // the first message of a new day has no entry to increment yet
  await Campaign.updateOne(
    { _id: campaignId, 'dailyStats.dayKey': { $ne: dayKey } },
    { $push: { dailyStats: { dayKey, openersSent: 0, qualified: 0, dealsSent: 0, [field]: amount } } }
  );
}

export async function markSent(job) {
  const counter = job.stage === 'opener' ? 'openersSent' : 'dealsSent';

  job.status = 'sent';
  job.sentAt = new Date();
  job.dayKey = job.dayKey || toLocalDateString();
  job.lastError = '';
  await job.save();

  await bumpStat(job.campaign, counter, 1);
  await recordDailyStat(job.campaign, job.dayKey, counter, 1);

  return job;
}

/**
 * A failed send goes back in the queue until the retry limit, then is parked as
 * failed. A parked job is never retried on a later run, so one broken number
 * cannot become a repeating failure.
 */
export async function markFailed(job, error) {
  job.lastError = String(error?.message || error || 'unknown error').slice(0, 300);

  if (job.attempts >= job.maxAttempts) {
    job.status = 'failed';
    await bumpStat(job.campaign, 'failed', 1);
  } else {
    job.status = 'queued';
  }

  await job.save();
  return job;
}

/** Used for "not now" and other deliberate skips. */
export async function markSkipped(job, reason) {
  job.status = 'skipped';
  job.lastError = String(reason || '').slice(0, 300);
  await job.save();
  return job;
}

export async function pendingCount(campaignId) {
  return SendJob.countDocuments({ campaign: campaignId, status: { $in: ['queued', 'sending'] } });
}
