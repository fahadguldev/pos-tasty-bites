/**
 * Temporary diagnostic: dumps the page-side WAPI surface so the adapter can call
 * the real methods instead of guessed names. Not part of the smoke suite.
 *
 *   node src/scripts/probe-wapi-surface.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createClient } = require('@open-wa/core');
const { PuppeteerDriver } = require('@open-wa/driver-puppeteer');

const userDataDir = path.resolve('./.broadcast-session', 'probe-wapi');
fs.mkdirSync(userDataDir, { recursive: true });

const client = await createClient({
  driver: new PuppeteerDriver(),
  sessionId: 'probe-wapi',
  userDataDir,
  browserArgs: ['--no-sandbox', '--disable-dev-shm-usage'],
  headless: true,
  qrTimeoutMs: 20000,
  authTimeoutMs: 20000,
});

// start() will fail on the QR timeout, which is fine: the runtime is injected
// well before that, which is all this probe needs.
client.start().catch(() => {});

await new Promise((r) => setTimeout(r, 45000));

const transport = client.getTransport();
const page = transport.getPage();

const dump = await page.evaluate(() => {
  const w = window.WAPI;
  if (!w) return { found: false, keys: [] };
  const keys = Object.keys(w).sort();
  const describe = (name) => {
    const fn = w[name];
    if (typeof fn !== 'function') return name + ' -> ' + typeof fn;
    return name + ' (arity ' + fn.length + ') -> ' + fn.toString().slice(0, 200).replace(/\s+/g, ' ');
  };
  return {
    found: true,
    total: keys.length,
    sends: keys.filter((k) => /^send|^add|interactiv|button|reply|list/i.test(k)),
    details: ['sendMessage', 'sendMessageReturnId', 'addAndSendMsgToChat', 'sendMsgToChat', 'getMe'].map(describe),
  };
});

console.log('\n=== WAPI SURFACE ===');
console.log(JSON.stringify(dump, null, 2));

try {
  await client.stop();
} catch {
  /* ignore */
}
process.exit(0);
