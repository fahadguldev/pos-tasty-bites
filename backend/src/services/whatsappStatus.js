import WhatsappSession, { WHATSAPP_SESSION_ID } from '../models/WhatsappSession.js';

/**
 * The small shared record that lets the admin panel see what the WhatsApp worker
 * is doing.
 *
 * The worker owns the browser, so the admin screen cannot ask the browser
 * anything directly. Instead the worker writes here on every change and the
 * admin screen reads from here. The commands go the other way.
 *
 * open-wa's own state names are internal, so they are translated into four
 * states an admin can act on: starting, awaiting_scan, ready, error.
 */

const OPENWA_STATE = {
  UNLAUNCHED: 'offline',
  DISCONNECTED: 'offline',
  STOPPED: 'offline',
  STARTING: 'starting',
  AUTHENTICATING: 'starting',
  SYNCING: 'starting',
  PAIRING: 'scanning',
  CONNECTED: 'ready',
  READY: 'ready',
  CONFLICT: 'error',
  TIMEOUT: 'error',
};

/** The QR is only worth showing while somebody could still scan it. */
const QR_TTL_MS = 5 * 60 * 1000;

export function describeStatus(state, { qr = '', qrIssuedAt = null, ready = false, lastError = '' } = {}) {
  const expired = Boolean(qrIssuedAt) && Date.now() - new Date(qrIssuedAt).getTime() > QR_TTL_MS;
  const liveQr = expired ? '' : qr;

  // ready and error are both final answers, so they are checked before the
  // transient ones rather than after
  let status;
  if (ready) status = 'ready';
  else if (lastError) status = 'error';
  else if (liveQr) status = 'awaiting_scan';
  else status = OPENWA_STATE[state] || 'starting';

  return { status, qr: liveQr, qrExpired: expired, lastError };
}

export async function publishStatus(patch = {}) {
  const update = { ...patch, heartbeatAt: new Date() };
  if (update.state) {
    const described = describeStatus(update.state, update);
    delete update.state;
    Object.assign(update, described);
  }
  await WhatsappSession.findByIdAndUpdate(WHATSAPP_SESSION_ID, { $set: update }, { upsert: true });
}

/** Always returns a usable object, so the admin screen never has to handle null. */
export async function readStatus() {
  const doc = await WhatsappSession.findById(WHATSAPP_SESSION_ID).lean();

  if (!doc) {
    return {
      status: 'offline',
      ready: false,
      qr: '',
      qrExpired: false,
      number: '',
      lastError: '',
      sessionId: 'tasty-bites',
      lastTest: { phone: '', ok: false, error: '', at: null },
      command: '',
      heartbeatAt: null,
    };
  }

  const alive = Boolean(doc.heartbeatAt) && Date.now() - new Date(doc.heartbeatAt).getTime() < 90 * 1000;

  return {
    ...doc,
    // a worker that stopped without saying so should not look connected
    ready: Boolean(doc.ready) && alive,
    status: alive ? doc.status : doc.status === 'ready' ? 'offline' : doc.status,
  };
}

/**
 * Asks the worker to do something. The browser lives in the worker, so the admin
 * cannot act on the session directly; it leaves a note and the worker picks it
 * up on its next pass.
 */
export async function requestCommand(command) {
  await WhatsappSession.findByIdAndUpdate(
    WHATSAPP_SESSION_ID,
    { $set: { command, lastTest: { phone: '', ok: false, error: '', at: null } } },
    { upsert: true },
  );
}

export async function recordTestResult({ phone, ok, error = '' }) {
  await WhatsappSession.findByIdAndUpdate(
    WHATSAPP_SESSION_ID,
    { $set: { lastTest: { phone, ok, error: String(error).slice(0, 200), at: new Date() } } },
  );
}

/**
 * Reads a pending admin command and clears it, so it only ever runs once.
 *
 * The document before the update is the one returned, because the update is what
 * clears the command. Returning the updated document would always read as empty.
 */
export async function takeCommand() {
  const doc = await WhatsappSession.findOneAndUpdate(
    { _id: WHATSAPP_SESSION_ID, command: { $ne: '' } },
    { $set: { command: '' } },
  );
  return doc?.command || '';
}
