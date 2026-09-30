import { asyncHandler } from '../middleware/asyncHandler.js';
import { readStatus, requestCommand } from '../services/whatsappStatus.js';
import { normalisePhone, isValidPkPhone } from '../utils/format.js';

/**
 * What the admin screen needs to know about the WhatsApp connection.
 *
 * The browser lives in the worker process, so this controller never touches
 * WhatsApp itself. It only reads the shared session record and leaves requests
 * for the worker to pick up.
 */

export const status = asyncHandler(async (req, res) => {
  const session = await readStatus();

  res.json({
    ...session,
    sendEnabled: process.env.WHATSAPP_SEND_ENABLED === 'true',
    transport: (process.env.WHATSAPP_TRANSPORT || '').trim().toLowerCase(),
    // shown in the admin screen so the next step is never a guess
    startCommand: 'npm run worker',
  });
});

/**
 * Signs out and clears the stored session, so a different number can be paired.
 * The admin cannot do this directly, so it is queued for the worker.
 */
export const logout = asyncHandler(async (req, res) => {
  await requestCommand('logout');
  res.json({ ok: true, note: 'The worker signs out on its next pass, within a few seconds.' });
});

/**
 * Sends one message to one number.
 *
 * This is the check to run before any campaign. It touches no contact and no
 * campaign, so it cannot message a customer by accident.
 */
export const sendTest = asyncHandler(async (req, res) => {
  const phone = normalisePhone(req.body?.phone);
  if (!isValidPkPhone(phone)) {
    return res.status(400).json({ error: 'Enter a valid Pakistani number, for example 03001234567' });
  }

  const session = await readStatus();
  if (!session.ready) {
    return res.status(409).json({ error: 'Connect WhatsApp first — the worker is not signed in yet' });
  }

  await requestCommand(`test:${phone}`);
  res.json({ ok: true, phone, note: 'The worker will send one test message shortly.' });
});
