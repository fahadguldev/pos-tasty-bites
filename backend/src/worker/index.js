/**
 * The WhatsApp worker.
 *
 *   npm run worker
 *
 * This is a separate process from the API on purpose. Signing in to WhatsApp
 * needs a real browser window, and a browser in the same process as an HTTP
 * server makes both of them harder to reason about and to restart. The two
 * processes only share the database: the admin screen starts campaigns, this
 * process is the only one that ever talks to WhatsApp.
 *
 * It does four things:
 *
 *   1. signs in, by printing a QR code for the phone to scan
 *   2. sends one queued message at a time, with the campaign's own pause
 *   3. listens for replies, so "yes" can queue the deal and "stop" can end it
 *   4. reports what it is doing, so the admin screen can show it
 */
import '../config/mongoose.js'; // must load before any model is compiled
import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../config/db.js';
import Campaign from '../models/Campaign.js';
import { getSettings } from '../models/Setting.js';
import { getTransport, SendDisabledError } from '../services/transport.js';
import { publishStatus, takeCommand, recordTestResult } from '../services/whatsappStatus.js';
import { handleInbound } from '../services/inbound.js';
import { logOutbound } from '../services/campaign.js';
import { claimNextJob, markSent, markFailed, gapMs, sleep, pendingCount } from '../services/sending.js';

dotenv.config();

/**
 * A finished campaign still has work to do. Customers reply days later, and the
 * deal they asked for is queued against the campaign that started it, so a
 * campaign that has already sent all its openers must keep being read.
 */
const READABLE_STATES = ['running', 'completed'];

const IDLE_INTERVAL_MS = Math.max(1000, Number(process.env.WHATSAPP_WORKER_INTERVAL_MS) || 5000);

let running = true;
let lastQr = '';

const log = (...args) => console.log('[worker]', ...args);

/** Keeps only the fields the shared session record knows about. */
function statusPatch(status) {
  return {
    state: status.state,
    qr: status.qr,
    qrIssuedAt: status.qrIssuedAt,
    number: status.number,
    ready: status.ready,
    lastError: status.lastError,
    sessionId: status.sessionId,
  };
}

function showQr(status) {
  if (status.qrAscii) {
    console.log('\n' + status.qrAscii + '\n');
  } else {
    console.log(`\nScan this in WhatsApp -> Linked devices -> Link a device:\n\n${status.qr}\n`);
  }
  log('waiting for the phone to scan...');
}

/**
 * Sends one job and records what happened. A failure is attributed to this one
 * customer and never stops the run, so one unreachable number cannot block the
 * rest of the campaign.
 */
async function deliver(transport, job, campaign) {
  try {
    await transport.sendText({
      to: job.phone,
      text: job.variant,
      buttons: job.buttons || [],
      imageUrl: job.imageUrl || '',
    });

    await markSent(job);
    await logOutbound(job);
    log(`sent ${job.stage} to ${job.phone}`);
  } catch (error) {
    await markFailed(job, error);
    await logOutbound(job, { error: String(error?.message || error) });
    log(`FAILED ${job.stage} to ${job.phone}: ${error.message}`);
  }

  // the pause is applied either way, so a failing number cannot make the
  // campaign send faster
  await sleep(gapMs(campaign.gap));
}

/** A running campaign with nothing left in the queue is finished. */
async function closeFinishedCampaigns() {
  const runningCampaigns = await Campaign.find({ status: 'running' }).select('_id').lean();

  for (const campaign of runningCampaigns) {
    if ((await pendingCount(campaign._id)) === 0) {
      await Campaign.updateOne(
        { _id: campaign._id, status: 'running' },
        { $set: { status: 'completed', completedAt: new Date() } },
      );
      log(`campaign ${campaign._id} finished sending`);
    }
  }
}

/**
 * A single message to one number, sent from the admin panel.
 *
 * This is the check to do before any campaign: it proves the number is signed in
 * and can actually deliver, without touching the contact list.
 */
async function runTestMessage(transport, phone) {
  const shop = await getSettings();

  try {
    await transport.sendText({
      to: phone,
      text: `This is a test message from ${shop.shopName}. If you are reading it, WhatsApp is connected correctly.`,
    });
    await recordTestResult({ phone, ok: true });
    log(`test message delivered to ${phone}`);
  } catch (error) {
    await recordTestResult({ phone, ok: false, error: String(error?.message || error) });
    log(`test message to ${phone} failed: ${error.message}`);
  }
}

/** Runs whatever the admin panel asked for. Returns true if the loop should end. */
async function handleCommand(transport, command) {
  if (!command) return false;

  if (command === 'logout') {
    log('signing out and clearing the stored session');
    await transport.logout();
    await publishStatus({ state: 'UNLAUNCHED', ready: false, number: '' });
    log('signed out. start the worker again to pair a new number.');
    return true;
  }

  if (command.startsWith('test:')) {
    await runTestMessage(transport, command.slice('test:'.length));
  }

  return false;
}

async function run() {
  if (process.env.WHATSAPP_SEND_ENABLED !== 'true') {
    throw new SendDisabledError(
      'WHATSAPP_SEND_ENABLED is not "true". Set it in .env only when you want this process to send for real.'
    );
  }

  await connectDB(process.env.MONGODB_URI || '');
  log('database connected');

  const transport = await getTransport({
    onStatus: (status) => {
      publishStatus(statusPatch(status)).catch(() => {});

      if (status.qr && status.qr !== lastQr) {
        lastQr = status.qr;
        showQr(status);
      }
      if (status.ready) log('signed in, ready to send');
    },
  });

  transport.onMessage(async ({ from, text, buttonId }) => {
    const result = await handleInbound({ from, text, buttonId });
    if (result.action !== 'ignored') log(`${from} -> ${result.action}`);
  });

  await publishStatus({ state: 'STARTING', workerPid: process.pid, startedAt: new Date() });
  await transport.connect();
  await publishStatus({ ...statusPatch(transport.status()), ready: true, workerPid: process.pid });

  log('running. press Ctrl+C to stop.');

  while (running) {
    if (await handleCommand(transport, await takeCommand())) break;

    const campaigns = await Campaign.find({ status: { $in: READABLE_STATES } })
      .sort({ updatedAt: 1 })
      .select('_id gap')
      .lean();

    let worked = false;

    for (const campaign of campaigns) {
      const job = await claimNextJob(campaign._id);
      if (!job) continue;
      await deliver(transport, job, campaign);
      worked = true;
      break;
    }

    if (worked) continue;

    await closeFinishedCampaigns();
    await publishStatus({ ...statusPatch(transport.status()), ready: transport.status().ready });
    await sleep(IDLE_INTERVAL_MS);
  }

  await transport.disconnect();
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!running) process.exit(0);
    log(`${signal} received, finishing up`);
    running = false;
  });
}

run()
  .then(async () => {
    await disconnectDB();
    process.exit(0);
  })
  .catch(async (error) => {
    await publishStatus({ state: 'STOPPED', ready: false, lastError: String(error?.message || error) }).catch(
      () => {}
    );
    console.error('[worker] stopped:', error.message);
    await disconnectDB();
    process.exit(1);
  });
