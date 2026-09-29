/**
 * The single place that decides how a message actually leaves the system.
 *
 * Two transports:
 *
 *   fake   records messages in memory. Every test uses this. It cannot send.
 *   openwa the real unofficial client, in src/services/openwaTransport.js
 *
 * Sending requires two environment variables to be set, so neither a stray
 * import, a forgotten config nor a test run can put a real number on the air:
 *
 *   WHATSAPP_TRANSPORT=openwa
 *   WHATSAPP_SEND_ENABLED=true
 *
 * The check happens when a transport is requested, not when this file is
 * imported, so the API server can load the module safely and simply never send.
 */

export const TRANSPORT_FAKE = 'fake';
export const TRANSPORT_OPENWA = 'openwa';

export class SendDisabledError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SendDisabledError';
  }
}

/**
 * Collects messages instead of sending them. Used by the smoke test to assert on
 * what would have gone out without a number ever being involved.
 */
export function createFakeTransport() {
  const sent = [];

  return {
    name: TRANSPORT_FAKE,
    sent,

    async connect() {},

    async disconnect() {},

    async sendText({ to, text, buttons = [], imageUrl = '' }) {
      if (!to || !text) throw new Error('sendText needs a recipient and a message');
      const record = { to, text, buttons, imageUrl, at: new Date() };
      sent.push(record);
      return { messageId: `fake-${sent.length}` };
    },

    // the fake transport never receives replies
    onMessage() {},
  };
}

let cached = null;

/**
 * Returns the transport named by the environment, or throws.
 *
 * The open-wa adapter is imported lazily so that a normal test run or a plain API
 * boot never pulls in Chromium, Puppeteer or the WhatsApp client at all.
 */
export async function getTransport({ onStatus } = {}) {
  if (cached) return cached;

  const name = (process.env.WHATSAPP_TRANSPORT || '').trim().toLowerCase();

  if (!name) {
    throw new SendDisabledError(
      'WHATSAPP_TRANSPORT is not set. Use "fake" for tests, or "openwa" to send for real.'
    );
  }

  if (name === TRANSPORT_FAKE) {
    cached = createFakeTransport();
    return cached;
  }

  if (name === TRANSPORT_OPENWA) {
    if (process.env.WHATSAPP_SEND_ENABLED !== 'true') {
      throw new SendDisabledError(
        'WHATSAPP_SEND_ENABLED is not "true". The worker will not send until you set it deliberately.'
      );
    }
    const { createOpenWaTransport } = await import('./openwaTransport.js');
    cached = await createOpenWaTransport({ onStatus });
    return cached;
  }

  throw new SendDisabledError(`Unknown WHATSAPP_TRANSPORT "${name}". Use "fake" or "openwa".`);
}

/** Drops the cached transport, so tests can swap it between cases. */
export function resetTransport() {
  cached = null;
}
