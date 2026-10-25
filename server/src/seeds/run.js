import mongoose from 'mongoose';
import { env, assertConfig } from '../config/env.js';
import { seed } from './data.js';
assertConfig();
if (
  !process.env.ADMIN_EMAIL ||
  !process.env.ADMIN_PASSWORD ||
  !process.env.DEMO_PASSWORD ||
  [process.env.ADMIN_PASSWORD, process.env.DEMO_PASSWORD].some(
    (p) => p.length < 12 || Buffer.byteLength(p) > 72
  )
)
  throw new Error(
    'Set ADMIN_EMAIL, ADMIN_PASSWORD and DEMO_PASSWORD (12–72 bytes) before seeding. Existing account passwords are never overwritten.'
  );
await mongoose.connect(env.mongo);
try {
  const accounts = await seed({
    password: process.env.DEMO_PASSWORD,
    adminEmail: process.env.ADMIN_EMAIL,
    adminPassword: process.env.ADMIN_PASSWORD,
  });
  console.log('Seeded fictional demonstration data and accounts:', accounts);
} finally {
  await mongoose.disconnect();
}
