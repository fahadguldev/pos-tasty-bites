/**
 * Builds the contact list from real order history.
 *
 *   npm run backfill             preview only, changes nothing
 *   npm run backfill -- --apply  write the contacts
 *
 * The preview is the default on purpose. A backfill that runs unattended is how
 * demo or mistyped numbers end up in a list the cafe is about to message.
 */
import '../config/mongoose.js'; // must load before any model is compiled
import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../config/db.js';
import { backfillFromOrders } from '../services/contactBackfill.js';

dotenv.config();

const apply = process.argv.includes('--apply');

await connectDB(process.env.MONGODB_URI || '');

if (apply) {
  console.log('\nRunning in WRITE mode. Contacts will be created in the database above.');
}

const { toCreate, toUpdate, skipped, scannedOrders, existingContacts, created, updated } =
  await backfillFromOrders({ dryRun: !apply });

console.log(`\nScanned ${scannedOrders} orders and found ${existingContacts} existing contacts.\n`);
console.log(`  would create   ${toCreate.length}`);
console.log(`  would update   ${toUpdate.length}`);
console.log(`  skipped        ${skipped.length}`);

if (toCreate.length) {
  console.log('\nNew contacts:');
  for (const entry of toCreate) {
    console.log(`  + ${entry.phone}  ${entry.name} (${entry.orderCount} orders)`);
  }
}

if (toUpdate.length) {
  console.log('\nAlready on file, order history would refresh:');
  for (const entry of toUpdate) {
    console.log(`  = ${entry.phone}  ${entry.name} (${entry.orderCount} orders)`);
  }
}

if (skipped.length) {
  console.log('\nSkipped:');
  for (const entry of skipped) {
    console.log(`  - ${entry.phone}  ${entry.name} — ${entry.reason}`);
  }
}

if (apply) {
  console.log(`\nDone. ${created} created, ${updated} updated.\n`);
} else {
  console.log('\nThis was a dry run. Nothing was written.');
  console.log('Re-run with --apply once the list above looks right.\n');
}

await disconnectDB();
