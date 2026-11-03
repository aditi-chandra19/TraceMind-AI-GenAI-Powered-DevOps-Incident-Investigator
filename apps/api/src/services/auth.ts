import 'dotenv/config';
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/User.js';
import { SessionModel } from '../models/Session.js';
import { databaseReady, memoryUsers, type MemoryUser } from './memoryStore.js';

export type UserRole = 'admin' | 'analyst' | 'viewer';
export interface Principal {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

const production = process.env.NODE_ENV === 'production';
const configuredSecret = process.env.JWT_SECRET;
const placeholderSecret = configuredSecret?.toLowerCase().includes('replace-with') ?? false;
if (production && (!configuredSecret || configuredSecret.length < 32 || placeholderSecret))
  throw new Error('Set a unique JWT_SECRET of at least 32 characters in production.');
const jwtSecret =
  configuredSecret && !placeholderSecret ? configuredSecret : randomBytes(48).toString('hex');
const demoEmail = (process.env.DEMO_ADMIN_EMAIL ?? 'admin@tracemind.local').trim().toLowerCase();
const demoPassword = process.env.DEMO_ADMIN_PASSWORD ?? 'TraceMindDemo!2026';
const demoHash = bcrypt.hash(demoPassword, 12);
const activeDemoSessions = new Map<string, number>();

export function demoModeEnabled() {
  if (production) return process.env.DEMO_MODE === 'true';
  return process.env.DEMO_MODE !== 'false';
}

function toPrincipal(user: {
  id?: string;
  _id?: unknown;
  name: string;
  email: string;
  role: string;
}): Principal {
  return {
    id: user.id ?? String(user._id),
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
  };
}

async function createSessionToken(user: Principal) {
  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  if (databaseReady()) await SessionModel.create({ jti, userId: user.id, expiresAt });
  else {
    if (activeDemoSessions.size >= 5_000)
      for (const [sessionId, expiry] of activeDemoSessions)
        if (expiry <= Date.now()) activeDemoSessions.delete(sessionId);
    activeDemoSessions.set(jti, expiresAt.getTime());
  }
  return jwt.sign({}, jwtSecret, {
    subject: user.id,
    jwtid: jti,
    expiresIn: '8h',
    issuer: 'tracemind-api',
    audience: 'tracemind-web',
  });
}

export async function authenticate(emailValue: string, password: string) {
  const email = emailValue.trim().toLowerCase();
  if (databaseReady()) {
    const user = await UserModel.findOne({ email, disabled: false }).select('+passwordHash');
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return null;
    const principal = toPrincipal({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
    return { user: principal, token: await createSessionToken(principal) };
  }
  const user = [...memoryUsers.values()].find((item) => item.email === email && !item.disabled);
  if (user && (await bcrypt.compare(password, user.passwordHash))) {
    const principal = toPrincipal({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
    return { user: principal, token: await createSessionToken(principal) };
  }
  if (
    demoModeEnabled() &&
    email === demoEmail &&
    (await bcrypt.compare(password, await demoHash))
  ) {
    const principal: Principal = {
      id: 'demo-admin',
      email: demoEmail,
      name: 'TraceMind Demo Admin',
      role: 'admin',
    };
    return { user: principal, token: await createSessionToken(principal) };
  }
  return null;
}

export async function registerUser(name: string, emailValue: string, password: string) {
  const email = emailValue.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 12);
  if (databaseReady()) {
    const user = await UserModel.create({
      name: name.trim(),
      email,
      passwordHash,
      role: 'analyst',
    });
    return toPrincipal({ _id: user._id, name: user.name, email: user.email, role: user.role });
  }
  if (!demoModeEnabled()) throw new Error('Database is not available; registration is disabled.');
  if ([...memoryUsers.values()].some((user) => user.email === email))
    throw new Error('An account with this email already exists.');
  const user: MemoryUser = {
    id: randomBytes(12).toString('hex'),
    name: name.trim(),
    email,
    passwordHash,
    role: 'analyst',
    disabled: false,
  };
  memoryUsers.set(user.id, user);
  return toPrincipal(user);
}

export async function signIn(user: Principal) {
  return createSessionToken(user);
}

export async function principalFromToken(token: string): Promise<Principal | null> {
  try {
    const claims = jwt.verify(token, jwtSecret, {
      issuer: 'tracemind-api',
      audience: 'tracemind-web',
    });
    if (typeof claims === 'string' || !claims.sub || !claims.jti) return null;
    if (databaseReady()) {
      if (
        !(await SessionModel.exists({
          jti: claims.jti,
          userId: claims.sub,
          expiresAt: { $gt: new Date() },
        }))
      )
        return null;
    } else {
      const expiresAt = activeDemoSessions.get(claims.jti);
      if (!expiresAt || expiresAt <= Date.now()) {
        activeDemoSessions.delete(claims.jti);
        return null;
      }
    }
    if (claims.sub === 'demo-admin' && demoModeEnabled())
      return { id: 'demo-admin', email: demoEmail, name: 'TraceMind Demo Admin', role: 'admin' };
    if (databaseReady()) {
      const user = await UserModel.findOne({ _id: claims.sub, disabled: false });
      return user
        ? toPrincipal({ _id: user._id, name: user.name, email: user.email, role: user.role })
        : null;
    }
    const user = memoryUsers.get(claims.sub);
    return user && !user.disabled ? toPrincipal(user) : null;
  } catch {
    return null;
  }
}

export async function revokeSession(token: string) {
  try {
    const claims = jwt.verify(token, jwtSecret, {
      issuer: 'tracemind-api',
      audience: 'tracemind-web',
    });
    if (typeof claims === 'string' || !claims.jti) return;
    if (databaseReady()) await SessionModel.deleteOne({ jti: claims.jti });
    else activeDemoSessions.delete(claims.jti);
  } catch {
    /* An absent or expired session is already revoked for the client. */
  }
}
