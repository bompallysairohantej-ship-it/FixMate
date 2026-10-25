import mongoose from 'mongoose';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env, root, assertConfig } from './config/env.js';
let localDatabase;
if (process.argv.includes('--demo')) {
  if (env.production) throw new Error('Demo mode cannot run in production.');
  process.env.FIXMATE_DEMO = 'true';
  const dir = path.join(root, '.data');
  await fs.mkdir(path.join(dir, 'mongo'), { recursive: true });
  let config;
  try {
    config = JSON.parse(await fs.readFile(path.join(dir, 'demo-config.json'), 'utf8'));
  } catch {
    config = {
      jwt: crypto.randomBytes(48).toString('hex'),
      password: `${crypto.randomBytes(12).toString('base64url')}!7a`,
    };
    await fs.writeFile(path.join(dir, 'demo-config.json'), JSON.stringify(config, null, 2), {
      mode: 0o600,
    });
  }
  env.jwt = config.jwt;
  const { startLocalDatabase } = await import('./config/local-database.js');
  const local = await startLocalDatabase(path.join(dir, 'mongo'));
  localDatabase = local.database;
  env.mongo = local.uri;
  await mongoose.connect(env.mongo);
  const { seed } = await import('./seeds/data.js');
  const accounts = await seed({ password: config.password });
  await fs.writeFile(
    path.join(dir, 'demo-accounts.txt'),
    `FixMate — LOCAL DEMO ONLY\nAll shops, reviews, and seeded records are fictional.\n\n${accounts.map((a) => `${a.role}: ${a.email}`).join('\n')}\n\nPassword: ${config.password}\n\nOpen http://localhost:5173\n`,
    { mode: 0o600 }
  );
  console.log('Persistent local MongoDB ready. Demo credentials: .data/demo-accounts.txt');
} else {
  assertConfig();
  await mongoose.connect(env.mongo);
}
const { default: app } = await import('./app.js');
const server = app.listen(env.port, '127.0.0.1', () =>
  console.log(`FixMate API ready: http://localhost:${env.port}`)
);
async function stop() {
  server.close();
  await mongoose.disconnect();
  if (localDatabase) await localDatabase.stop({ doCleanup: false, force: false });
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
