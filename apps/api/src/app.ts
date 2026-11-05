import cors from 'cors';
import cookieParser from 'cookie-parser';
import express, { type ErrorRequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { authRouter } from './routes/auth.js';
import { auditRouter } from './routes/audit.js';
import { incidentRouter } from './routes/incidents.js';
import { logRouter } from './routes/logs.js';
import { investigationRouter } from './routes/investigations.js';
import { requireAuth } from './middleware/auth.js';
import { listIncidents } from './services/incidents.js';
import { databaseReady } from './services/memoryStore.js';
import { maxUploadMb } from './config/limits.js';

export const app = express();
app.disable('x-powered-by');
// Nginx is the only deployed upstream and replaces X-Forwarded-For with its peer address.
app.set('trust proxy', 1);
app.use(helmet());
const configuredWebOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
const viteDevOrigin = /^http:\/\/(?:localhost|127\.0\.0\.1):517[0-9]$/;
app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        origin === configuredWebOrigin ||
        (process.env.NODE_ENV !== 'production' && viteDevOrigin.test(origin))
      )
        return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(
  pinoHttp({
    level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'req.headers.set-cookie'],
      censor: '[REDACTED]',
    },
  }),
);
app.use(
  '/api',
  rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }),
);

app.get('/api/health', (_req, res) =>
  res.json({
    status: 'ok',
    mode: databaseReady() ? 'mongodb' : 'demo',
    timestamp: new Date().toISOString(),
    limits: { maxUploadMb },
  }),
);
app.use('/api/auth', authRouter);
app.use('/api/audit', auditRouter);
app.use('/api/incidents', incidentRouter);
app.use('/api/logs', logRouter);
app.use('/api/investigations', investigationRouter);
app.get('/api/overview', requireAuth, async (_req, res, next) => {
  try {
    const result = await listIncidents({ page: 1, limit: 100 });
    const active = result.data.filter((incident) => incident.status !== 'resolved');
    return res.json({
      data: {
        active: active.length,
        critical: active.filter((incident) => incident.severity === 'critical').length,
        affectedUsers: '3.6k',
        mttr: '42m',
        incidents: result.data,
      },
      mode: databaseReady() ? 'mongodb' : 'demo',
    });
  } catch (error) {
    return next(error);
  }
});

app.use(((error: unknown, req, res, _next) => {
  req.log?.error({ err: error }, 'Unhandled API error');
  res.status(500).json({ error: 'Internal server error' });
}) as ErrorRequestHandler);
