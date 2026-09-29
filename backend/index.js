import './src/config/mongoose.js'; // must load before any model is compiled
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import router from './src/routes/index.js';
import { initCloudinary } from './src/config/cloudinary.js';
import { connectDB } from './src/config/db.js';
import { getSettings } from './src/models/Setting.js';
import Admin from './src/models/Admin.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://localhost:4173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // allow same-origin/non-browser callers such as curl and the receipt download
      if (!origin || CLIENT_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '8mb' }));

// on a long-lived server this is already resolved by the time the first request
// arrives; on serverless it is what connects MongoDB during the cold start
app.use((req, res, next) => {
  bootstrap().then(
    () => next(),
    (err) => {
      console.error('Startup failed:', err);
      if (!res.headersSent) res.status(503).json({ error: 'Service unavailable' });
    }
  );
});

// stops someone hammering the login and review endpoints
app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  })
);

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'tasty-bites-api' }));
app.use('/api', router);

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err?.message === 'Origin not allowed by CORS') {
    return res.status(403).json({ error: 'This origin is not allowed to call the API' });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }

  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error('[error]', err);

  res.status(status).json({ error: err.message || 'Something went wrong on our end' });
});

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Refusing to start — generate one with:');
  console.error('  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
  process.exit(1);
}

initCloudinary();

let bootPromise;

export function bootstrap() {
  if (!bootPromise) {
    bootPromise = start().catch((err) => {
      bootPromise = undefined;
      throw err;
    });
  }
  return bootPromise;
}

async function start() {
  if (mongoose.connection.readyState !== 1) {
    await connectDB(process.env.MONGODB_URI);
    console.log('MongoDB connected');
  }

  // the in-memory dev database starts empty, so fill it with the demo menu
  if (!process.env.MONGODB_URI && process.env.AUTO_SEED !== 'false') {
    const { seed } = await import('./src/seed/seed.js');
    await seed();
  }

  // guarantee there is always a shop record and one admin to sign in with
  const settings = await getSettings();
  if (!settings.shopName) await settings.updateOne({ $set: { shopName: 'Tasty Bites' } });

  if ((await Admin.countDocuments()) === 0) {
    const email = (process.env.ADMIN_EMAIL || 'admin@tastybites.pk').toLowerCase();
    const password = process.env.ADMIN_PASSWORD || 'tastybites123';
    const admin = new Admin({ name: process.env.ADMIN_NAME || 'Owner', email, role: 'owner' });
    await admin.setPassword(password);
    await admin.save();
    console.log(`Created admin account -> ${email} / ${password}`);
    console.log('Change this password from the admin settings after first sign-in.');
  }

  return app;
}

export default app;

// only start listening when this file is the entry point, so tests can import the app
const isEntryPoint = process.argv[1] && process.argv[1].endsWith('index.js');

if (isEntryPoint) {
  bootstrap()
    .then((instance) => instance.listen(PORT, () => console.log(`Tasty Bites API listening on http://localhost:${PORT}`)))
    .catch((err) => {
      console.error('Could not start the API:', err.message);
      process.exit(1);
    });
}
