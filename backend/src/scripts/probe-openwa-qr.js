/**
 * Temporary manual probe: proves the real open-wa adapter can log in far enough
 * to receive a QR, and that the QR lands in the shared session record the admin
 * API serves. Not part of the smoke suite because it needs a real browser.
 *
 *   node src/scripts/probe-openwa-qr.js
 */
import { connectDB, disconnectDB } from '../config/db.js';
import { createOpenWaTransport } from '../services/openwaTransport.js';
import { publishStatus, readStatus } from '../services/whatsappStatus.js';

const WAIT_MS = Number(process.env.PROBE_WAIT_MS || 120000);

/** Mirrors the worker's statusPatch so the probe exercises the same write path. */
const statusPatch = (status) => ({
  state: status.state,
  qr: status.qr,
  qrIssuedAt: status.qrIssuedAt,
  number: status.number,
  ready: status.ready,
  lastError: status.lastError,
  sessionId: status.sessionId,
});

await connectDB('');

let transport = null;
let sawQrInAdapter = false;

try {
  transport = await createOpenWaTransport({
    onStatus(snapshot) {
      publishStatus(statusPatch(snapshot)).catch(() => {});

      if (snapshot.qr && !sawQrInAdapter) {
        sawQrInAdapter = true;
        console.log('[probe] adapter received a QR from open-wa');
      }
      if (snapshot.state) {
        console.log(`[probe] state=${snapshot.state} ready=${snapshot.ready} number=${snapshot.number || '-'}`);
      }
    },
  });

  console.log('[probe] connecting (launching Chrome, this takes ~30s)…');

  // client.start() blocks until the QR is scanned or the timeout expires, so it
  // must not be awaited here — the QR has to be read from Mongo while it waits.
  const connecting = transport.connect().catch((error) => {
    console.error('[probe] connect() ended:', error?.message || error);
  });

  const deadline = Date.now() + WAIT_MS;
  let record = null;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    record = await readStatus();

    if (record.qr) {
      console.log('\n[probe] PASS — QR reached the shared session record');
      console.log(`[probe]   status       : ${record.status}`);
      console.log(`[probe]   qr length    : ${record.qr.length} chars`);
      console.log(`[probe]   qr issued at : ${record.qrIssuedAt}`);
      console.log(`[probe]   still fresh  : ${!record.qrExpired}`);
      break;
    }

    console.log(`[probe] waiting… status=${record.status} ready=${record.ready}`);
  }

  if (!record?.qr) {
    console.log('\n[probe] FAIL — no QR was published within the wait window');
    console.log('[probe] last record:', JSON.stringify(record, null, 2));
    process.exitCode = 1;
  }

  await connecting.catch(() => {});
} catch (error) {
  console.error('[probe] FAILED:', error?.message || error);
  process.exitCode = 1;
} finally {
  try {
    await transport?.disconnect?.();
  } catch {
    /* ignore */
  }
  await disconnectDB();
}

process.exit(process.exitCode || 0);
