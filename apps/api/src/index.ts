import './config/env.js';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { app } from './app.js';
import { UserModel } from './models/User.js';
import { seedIncidents } from './services/incidents.js';
import { seedKnowledge } from './services/retrieval.js';
import { demoModeEnabled } from './services/auth.js';

const port = Number(process.env.PORT ?? 4000);
let server: ReturnType<typeof app.listen>;
const runtimeState = globalThis as typeof globalThis & { __traceMindMongoReady?: boolean };
const requiresMongo = process.env.NODE_ENV === 'production' || process.env.DEMO_MODE === 'false';
if (requiresMongo && !process.env.MONGODB_URI)
  throw new Error('MONGODB_URI is required when demo mode is disabled.');
if (process.env.MONGODB_URI) {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    runtimeState.__traceMindMongoReady = true;
    await seedIncidents();
    await seedKnowledge();
    if (demoModeEnabled()) {
      const email = (process.env.DEMO_ADMIN_EMAIL ?? 'admin@tracemind.local').trim().toLowerCase();
      if (!(await UserModel.exists({ email })))
        await UserModel.create({
          name: 'TraceMind Demo Admin',
          email,
          passwordHash: await bcrypt.hash(
            process.env.DEMO_ADMIN_PASSWORD ?? 'TraceMindDemo!2026',
            12,
          ),
          role: 'admin',
        });
    }
    console.info('MongoDB connected; demo incidents are seeded idempotently');
  } catch (error) {
    runtimeState.__traceMindMongoReady = false;
    if (requiresMongo) throw error;
    console.warn(
      'MongoDB unavailable; starting in demo mode',
      error instanceof Error ? error.message : 'connection error',
    );
  }
}
mongoose.connection.on('connected', () => {
  runtimeState.__traceMindMongoReady = true;
});
mongoose.connection.on('disconnected', () => {
  runtimeState.__traceMindMongoReady = false;
});
server = app.listen(port, () =>
  console.info(`TraceMind API listening on http://localhost:${port}`),
);
const shutdown = async () => {
  server.close();
  runtimeState.__traceMindMongoReady = false;
  await mongoose.disconnect().catch(() => undefined);
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
