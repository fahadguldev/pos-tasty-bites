import mongoose from 'mongoose';

/**
 * Spins up a throwaway MongoDB for local development and CI.
 * Data is wiped when the process exits — use a real MongoDB for anything real.
 */
let memoryServer;

export async function connectDB(uri) {
  if (uri) return mongoose.connect(uri);

  // loaded on demand so a production install that omits devDependencies still boots
  const { MongoMemoryServer } = await import('mongodb-memory-server');

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
