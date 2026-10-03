import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { normalisePhone } from '../utils/format.js';

/**
 * The real WhatsApp connection, built on the unofficial open-wa client.
 *
 * This file is the only place that knows open-wa exists. Everything above it
 * (the campaign engine, the worker, the tests) talks to a small interface:
 *
 *   connect()                 launch the browser and sign in
 *   sendText({ to, text })    deliver one message
 *   onMessage(handler)        report customer replies
 *   status()                  what the connection is currently doing
 *   disconnect()              shut the browser down
 *
 * open-wa drives a real Chromium window through WhatsApp Web, so a phone number
 * is signed in by scanning a QR code rather than with a token. That means this
 * adapter also has to cope with a login that has not happened yet, which is why
 * connect() reports progress through onStatus instead of only resolving once.
 *
 * The whole client, including the browser, is loaded lazily. A test run or a
 * plain API boot never imports it.
 */

const CHAT_SUFFIX = '@c.us';

/** States in which messages can actually leave the account. */
const USABLE_STATES = new Set(['CONNECTED', 'READY']);

/** How many message ids to remember when dropping a button tap's text echo. */
const SEEN_LIMIT = 500;

function envFlag(name, fallback) {
  const raw = String(process.env[name] ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  return raw === 'true' || raw === '1' || raw === 'yes';
}

function envNumber(name, fallback) {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

export function resolveChromePath() {
  const configured = String(process.env.WHATSAPP_CHROME_PATH || '').trim();
  if (configured && fs.existsSync(configured)) {
    return configured;
  }

  const standardPaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
    '/opt/google/chrome/google-chrome',
    '/opt/google/chrome/chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];

  for (const p of standardPaths) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {}
  }

  return undefined;
}

/**
 * WhatsApp addresses a chat as the bare number plus "@c.us". A phone number on
 * its own is not a valid destination, so every send goes through here.
 *
 * The number is normalised first. A number stored as 0300… would otherwise
 * produce a chat id that WhatsApp accepts and silently never delivers to, which
 * looks exactly like a message that was sent.
 */
export function toChatId(phone) {
  const digits = normalisePhone(phone);
  if (!digits) throw new Error('A recipient phone number is required');
  return `${digits}${CHAT_SUFFIX}`;
}

export function fromChatId(chatId) {
  return String(chatId || '').split('@')[0].replace(/\D/g, '');
}

/**
 * Unwraps an open-wa event payload.
 *
 * Everything under launch.*, session.* and core.* arrives as a "step event",
 * which keeps its data inside a nested details object. Data events such as
 * message.* and interactive.* put it at the top level instead. Reading the wrong
 * one silently loses the data, which is how a QR code and every state change
 * once went missing even though the client was working perfectly.
 */
export function eventData(payload) {
  if (payload && typeof payload === 'object' && payload.details) return payload.details;
  return payload && typeof payload === 'object' ? payload : {};
}

/**
 * Builds a quick-reply button.
 *
 * A queued job stores button labels, and a tapped button comes back as the id
 * that was sent. Sending the label as the id means the reply handler can match
 * the tap straight back to the option the admin chose, with no extra table.
 */
function toReplyAction(button) {
  const label = String(button?.label ?? button ?? '').trim().slice(0, 40);
  if (!label) throw new Error('A quick-reply button needs a label');
  return { type: 'reply', id: String(button?.id || label).trim().slice(0, 40), label };
}

/**
 * Resolves once the session can send, rejects if nobody scans in time.
 *
 * The QR has usually already been emitted by the time this is called, so the
 * caller shows it from its onStatus callback while this promise is pending.
 */
function waitForUsableSession(client, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (USABLE_STATES.has(client.getState())) {
      resolve(client.getState());
      return;
    }

    const onChange = ({ next }) => {
      if (!USABLE_STATES.has(next)) return;
      clearTimeout(timer);
      client.events.off('session.state.changed', onChange);
      resolve(next);
    };

    const timer = setTimeout(() => {
      client.events.off('session.state.changed', onChange);
      reject(new Error(`Not signed in after ${Math.round(timeoutMs / 1000)}s. The QR code was not scanned.`));
    }, timeoutMs);

    client.events.on('session.state.changed', onChange);
  });
}

function imageFilename(url) {
  const name = String(url || '').split('?')[0].split('/').pop() || '';
  return /\.[a-z0-9]{2,5}$/i.test(name) ? name : 'deal.jpg';
}

export async function createOpenWaTransport({ onStatus = () => {} } = {}) {
  // Loaded with require rather than import on purpose. @open-wa/core finds its
  // own wapi.js runtime asset by reading the current stack frame's file name,
  // which V8 reports as a file:/// URL under ESM. path.join then mangles that
  // into file:\... and the lookup fails. A CJS require yields a real path.
  // @open-wa/core is also used instead of the @open-wa/wa-automate umbrella,
  // which pulls in session-sync and demands a native zstd binary on import.
  const require = createRequire(import.meta.url);
  const { createClient } = require('@open-wa/core');
  const { PuppeteerDriver } = require('@open-wa/driver-puppeteer');

  const sessionId = (process.env.WHATSAPP_SESSION_ID || 'tasty-bites').trim();
  const sessionPath = path.resolve(
    process.env.WHATSAPP_SESSION_PATH || path.join(process.cwd(), '.broadcast-session'),
  );
  const userDataDir = path.join(sessionPath, sessionId);
  const loginTimeoutMs = envNumber('WHATSAPP_LOGIN_TIMEOUT_MS', 5 * 60 * 1000);

  fs.mkdirSync(userDataDir, { recursive: true });

  const browserArgs = ['--no-sandbox', '--disable-dev-shm-usage'];
  const proxy = String(process.env.WHATSAPP_PROXY || '').trim();
  if (proxy) browserArgs.push(`--proxy-server=${proxy}`);

  let client = null;
  let messageHandler = null;
  let lastError = '';

  const seen = new Set();
  const remember = (id) => {
    if (!id) return;
    seen.add(String(id));
    if (seen.size > SEEN_LIMIT) seen.delete(seen.values().next().value);
  };

  const current = {
    sessionId,
    state: 'UNLAUNCHED',
    ready: false,
    qr: '',
    qrAscii: '',
    qrIssuedAt: null,
    number: '',
    lastError: '',
    updatedAt: new Date(),
  };

  const publish = (patch = {}) => {
    Object.assign(current, patch, { updatedAt: new Date() });
    onStatus({ ...current });
  };

  const emitInbound = (message) => {
    if (!messageHandler || !message.from) return;
    Promise.resolve(messageHandler(message)).catch((error) => {
      lastError = String(error?.message || error);
      publish({ lastError });
    });
  };

  /**
   * A tapped button arrives as its own event and then again as a plain text
   * message carrying the label. Only the first copy is wanted, otherwise every
   * tap would be handled twice.
   */
  const handleButtonTap = (response) => {
    if (!response || typeof response !== 'object' || response.type !== 'reply') return;
    remember(response.messageId);
    remember(response.originalMessageId);
    emitInbound({
      from: fromChatId(response.senderId || response.chatId),
      text: String(response.label || ''),
      buttonId: String(response.id || ''),
      messageId: String(response.messageId || ''),
    });
  };

  const handleTextMessage = (message) => {
    if (!message || message.fromMe) return;
    if (message.isNotification || message.isGroupMsg) return;

    const id = String(message.id || '');
    if (id && seen.has(id)) return;
    remember(id);

    const body = String(message.body || message.caption || '').trim();
    if (!body) return;

    emitInbound({
      from: fromChatId(message.chatId || message.from),
      text: body,
      buttonId: '',
      messageId: id,
    });
  };

  /**
   * Everything under launch.*, session.* and core.* arrives as a "step event",
   * which keeps its data inside a nested details object. Data events such as
   * message.* and interactive.* put it at the top level instead. Accepting both
   * shapes here keeps the wiring below short and tolerant of either layout.
   */
  const data = eventData;

  const wireEvents = () => {
    client.events.on('session.state.changed', (payload) => {
      const { next, reason } = data(payload);
      if (!next) return;
      publish({ state: next, ready: USABLE_STATES.has(next), lastError: reason || '' });
    });

    client.events.on('launch.auth.qr.generated', (payload) => {
      const { qr, ascii } = data(payload);
      if (!qr) return;
      publish({ qr, qrAscii: ascii || '', qrIssuedAt: new Date() });
    });

    client.events.on('launch.auth.qr.scanned', () => publish({ qrIssuedAt: current.qrIssuedAt }));
    client.events.on('launch.auth.qr.expired', () => publish({ qr: '', qrAscii: '' }));

    // An unscanned code expiring is ordinary, so it only clears the code. A
    // phone that cannot be reached is a real problem and is surfaced as one.
    client.events.on('launch.auth.timeout', (payload) => {
      const { phoneOutOfReach } = data(payload);
      publish(
        phoneOutOfReach
          ? { qr: '', qrAscii: '', lastError: 'The phone could not be reached. Check the number and try again.' }
          : { qr: '', qrAscii: '' },
      );
    });

    client.events.on('client.ready', () => publish({ ready: true, qr: '', qrAscii: '' }));

    client.events.on('session.logout', (payload) => {
      const { reason } = data(payload);
      publish({ ready: false, qr: '', qrAscii: '', lastError: reason || 'signed out' });
    });

    client.events.on('error', (payload) => {
      const message = payload?.error?.message || payload?.error || '';
      if (message) publish({ lastError: String(message) });
    });

    client.events.on('message.received', ({ message }) => handleTextMessage(message));
    client.events.on('interactive.response', ({ response }) => handleButtonTap(response));
  };

  const readLinkedNumber = async () => {
    try {
      const me = await client.getTransport().getMe?.();
      const id = me?.id || me?.wid || me?.contactId || '';
      const digits = String(id).replace(/\D/g, '');
      if (digits) publish({ number: digits });
    } catch {
      // the number is only used for display, so a failure here is not worth
      // interrupting a send
    }
  };

  return {
    name: 'openwa',
    sessionId,

    status: () => ({ ...current }),

    onMessage(handler) {
      messageHandler = handler;
    },

    async connect() {
      if (client) return;

      publish({ state: 'STARTING', lastError: '' });

      const created = await createClient({
        driver: new PuppeteerDriver(),
        sessionId,
        userDataDir,
        browserArgs,
        headless: envFlag('WHATSAPP_HEADLESS', true),
        debug: envFlag('WHATSAPP_DEBUG', false),
        deleteSessionDataOnLogout: true,
        killClientOnLogout: true,
        executablePath: resolveChromePath(),
        qrTimeoutMs: loginTimeoutMs,
        authTimeoutMs: loginTimeoutMs,
      });

      client = created;
      wireEvents();

      // A failed start still leaves a real Chrome process running. Without this
      // the browser piles up on every retry until the machine runs out of memory,
      // so a failed attempt is always torn down before the error is rethrown.
      try {
        await created.start();

        publish({ state: created.getState() });
        await waitForUsableSession(created, loginTimeoutMs);

        publish({ state: created.getState(), ready: true, qr: '', qrAscii: '' });
        await readLinkedNumber();
      } catch (error) {
        lastError = String(error?.cause?.message || error?.message || error);
        publish({ state: 'STOPPED', ready: false, lastError });

        client = null;
        try {
          await created.stop();
        } catch {
          // the browser may already be gone, which is the outcome wanted anyway
        }

        throw error;
      }
    },

    /**
     * Delivers one message.
     *
     * The three shapes are mutually exclusive on purpose. A campaign opener
     * carries buttons, the deal carries a picture, and anything else is plain
     * text, so there is never a question of which one wins.
     */
    async sendText({ to, text, buttons = [], imageUrl = '' }) {
      if (!client) throw new Error('The WhatsApp session is not connected yet');
      if (!to || !text) throw new Error('sendText needs a recipient and a message');
      if (!USABLE_STATES.has(client.getState())) {
        throw new Error('The WhatsApp session is not signed in yet');
      }

      const chatId = toChatId(to);
      const transport = client.getTransport();

      if (imageUrl) {
        try {
          const messageId = await transport.sendFileFromUrl(
            chatId,
            imageUrl,
            imageFilename(imageUrl),
            text,
          );
          return { messageId: String(messageId || '') };
        } catch {
          // a picture that will not download must not swallow the offer itself
          const messageId = await transport.sendText(chatId, text);
          return { messageId: String(messageId || ''), imageFailed: true };
        }
      }

      if (buttons.length) {
        const messageId = await transport.sendInteractive(chatId, {
          type: 'buttons',
          body: text,
          actions: buttons.map(toReplyAction),
        });
        return { messageId: String(messageId || '') };
      }

      const messageId = await transport.sendText(chatId, text);
      return { messageId: String(messageId || '') };
    },

    /**
     * Signs out and clears the stored session, so the next start shows a fresh
     * QR code. Used when a number needs to be replaced.
     */
    async logout() {
      if (client) {
        await client.stop('signed out from the admin panel');
        client = null;
      }
      fs.rmSync(userDataDir, { recursive: true, force: true });
      seen.clear();
      publish({ state: 'UNLAUNCHED', ready: false, qr: '', qrAscii: '', number: '' });
    },

    async disconnect() {
      if (!client) return;
      const stopping = client;
      client = null;
      await stopping.stop('worker shutting down');
      publish({ state: 'STOPPED', ready: false });
    },
  };
}
