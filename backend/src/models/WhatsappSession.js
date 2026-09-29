import mongoose from 'mongoose';

/**
 * What the WhatsApp worker is currently doing.
 *
 * The browser session lives in the worker process, but the admin panel lives in
 * the API process, and the admin still needs to see the QR code and the state.
 * A single shared document is the bridge: the worker writes to it, the admin
 * screen reads from it. That keeps the two apart without adding a second
 * service such as Redis to run.
 *
 * There is only ever one session, so the id is fixed.
 */

const SESSION_ID = 'default';

const WhatsappSessionSchema = new mongoose.Schema(
  {
    _id: { type: String, default: SESSION_ID },

    // offline, starting, awaiting_scan, scanning, ready, error, stopped
    status: { type: String, default: 'offline' },

    /** the raw pairing string, which the admin screen turns into a QR image */
    qr: { type: String, default: '' },
    qrIssuedAt: { type: Date, default: null },

    /** the linked number, so the admin can see which line is connected */
    number: { type: String, default: '' },

    ready: { type: Boolean, default: false },
    sessionId: { type: String, default: 'tasty-bites' },
    lastError: { type: String, default: '' },

    workerPid: { type: Number, default: null },
    startedAt: { type: Date, default: null },
    heartbeatAt: { type: Date, default: null },

    /** the result of the last single test message, so the admin can see it worked */
    lastTest: {
      phone: { type: String, default: '' },
      ok: { type: Boolean, default: false },
      error: { type: String, default: '' },
      at: { type: Date, default: null },
    },

    /** set by the admin, read and cleared by the worker. "logout" or "test:<number>". */
    command: { type: String, default: '' },
  },
  { timestamps: true }
);

export const WHATSAPP_SESSION_ID = SESSION_ID;

export default mongoose.model('WhatsappSession', WhatsappSessionSchema);
