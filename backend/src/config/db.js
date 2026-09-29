import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Spins up a throwaway MongoDB for local development and CI.
 * Data is wiped when the process exits — use a real MongoDB for anything real.
 */
let memoryServer;

export async function connectDB(uri) {
  if (uri) return mongoose.connect(uri);

  memoryServer = await MongoMemoryServer.create({
    instance: { dbName: 'tasty_bites' },
  });

  const memoryUri = memoryServer.getUri();
  console.log('No MONGODB_URI set — started an in-memory MongoDB for development.');
  console.log(`  ${memoryUri}`);
  console.log('  Data will be lost when you stop the server.');

  await mongoose.connect(memoryUri);
  return memoryUri;
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}
