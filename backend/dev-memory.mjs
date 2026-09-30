/**
 * Boot the API against an in-memory MongoDB instead of Atlas.
 *
 *   node dev-memory.mjs
 *
 * Same trick as src/smoke.js: force MONGODB_URI empty before anything reads it,
 * so config/db.js falls back to mongodb-memory-server. Everything else (the
 * demo seed, the admin account) behaves exactly as it does locally.
 */
process.env.MONGODB_URI = '';

const { bootstrap } = await import('./index.js');
const app = await bootstrap();
const port = Number(process.env.PORT) || 4000;

app.listen(port, () => {
  console.log(`Tasty Bites API on http://localhost:${port} (in-memory MongoDB)`);
});
