import MessageLog from '../models/MessageLog.js';

/**
 * Writes one line to the message history.
 *
 * Deliberately swallows its own errors. A full disk or a dropped connection
 * should never be the reason a customer goes without their deal, so logging
 * failures are silent by design.
 */
export async function logMessage(entry) {
  try {
    await MessageLog.create({
      campaign: entry.campaign || null,
      job: entry.job || null,
      contact: entry.contact || null,
      phone: entry.phone,
      direction: entry.direction,
      stage: entry.stage || 'system',
      kind: entry.kind || '',
      body: String(entry.body || '').slice(0, 1000),
      imageUrl: entry.imageUrl || '',
      error: entry.error || '',
    });
  } catch {
    // a log that cannot be written is not worth failing a send over
  }
}
