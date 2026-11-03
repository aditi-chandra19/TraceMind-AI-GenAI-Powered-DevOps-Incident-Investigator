import '../config/env.js';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { UserModel } from '../models/User.js';
import { seedIncidents } from '../services/incidents.js';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('Set MONGODB_URI before running the seed script.');
try {
  await mongoose.connect(uri);
  (globalThis as typeof globalThis & { __traceMindMongoReady?: boolean }).__traceMindMongoReady =
    true;
  await seedIncidents();

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email || password) {
    if (
      !email ||
      !password ||
      Buffer.byteLength(password, 'utf8') < 12 ||
      Buffer.byteLength(password, 'utf8') > 72
    )
      throw new Error('Set both ADMIN_EMAIL and an ADMIN_PASSWORD between 12 and 72 bytes.');
    if (await UserModel.exists({ email }))
      throw new Error(
        `An account already exists for ${email}; seed script will not replace its password.`,
      );
    await UserModel.create({
      name: 'TraceMind Administrator',
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'admin',
    });
    console.info(`Created administrator ${email}`);
  }
  console.info('Demo incidents are present (safe to re-run). No real production data was changed.');
} finally {
  await mongoose.disconnect();
}
