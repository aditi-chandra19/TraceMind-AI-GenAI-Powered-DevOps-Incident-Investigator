import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { writeAuditLog } from '../services/audit.js';
import { InvestigationFeedbackModel } from '../models/InvestigationFeedback.js';
import {
  databaseReady,
  ensureStorageAvailable,
  memoryInvestigationFeedback,
} from '../services/memoryStore.js';
import { getIncident } from '../services/incidents.js';
import { investigateIncident } from '../services/investigationChat.js';
import { searchKnowledge } from '../services/retrieval.js';

export const investigationRouter = Router();
investigationRouter.use(requireAuth);
const investigationLimit = rateLimit({
  windowMs: 60 * 60_000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});
const searchSchema = z.object({ query: z.string().trim().min(2).max(500) });
const chatSchema = z.object({
  incidentId: z.string().trim().min(1).max(40),
  message: z.string().trim().min(2).max(1200),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(1200) }))
    .max(8)
    .optional(),
});
const feedbackSchema = z.object({
  incidentId: z.string().trim().min(1).max(40),
  rating: z.enum(['helpful', 'not-helpful']),
  comment: z.string().trim().max(500).optional().default(''),
});
const feedbackQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  incidentId: z.string().trim().max(40).optional(),
});

investigationRouter.post('/search', investigationLimit, async (req, res, next) => {
  const parsed = searchSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ error: 'Invalid knowledge search', details: parsed.error.flatten() });
  try {
    const result = await searchKnowledge(parsed.data.query, 6);
    return res.json({ data: result });
  } catch (error) {
    return next(error);
  }
});

investigationRouter.post(
  '/chat',
  investigationLimit,
  requireRole('admin', 'analyst'),
  async (req, res, next) => {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: 'Invalid investigation message', details: parsed.error.flatten() });
    try {
      const data = await investigateIncident(
        parsed.data.incidentId,
        parsed.data.message,
        parsed.data.history,
      );
      if (!data) return res.status(404).json({ error: 'Incident not found' });
      await writeAuditLog({
        actorId: req.principal!.id,
        actorEmail: req.principal!.email,
        action: 'investigation.chat',
        resourceType: 'incident',
        resourceId: parsed.data.incidentId,
        details: { mode: data.mode, citationCount: data.citations.length },
      });
      return res.json({ data });
    } catch (error) {
      return next(error);
    }
  },
);

investigationRouter.get('/feedback', requireRole('admin'), async (req, res, next) => {
  const parsed = feedbackQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid query parameters' });
  const { page, limit, incidentId } = parsed.data;
  try {
    ensureStorageAvailable();
    if (databaseReady()) {
      const filter = incidentId ? { incidentId } : {};
      const [data, total] = await Promise.all([
        InvestigationFeedbackModel.find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        InvestigationFeedbackModel.countDocuments(filter),
      ]);
      return res.json({
        data,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        mode: 'mongodb',
      });
    }
    const filtered = memoryInvestigationFeedback.filter(
      (item) => !incidentId || item.incidentId === incidentId,
    );
    const start = (page - 1) * limit;
    return res.json({
      data: filtered.slice(start, start + limit),
      pagination: {
        page,
        limit,
        total: filtered.length,
        pages: Math.ceil(filtered.length / limit),
      },
      mode: 'demo',
    });
  } catch (error) {
    return next(error);
  }
});

investigationRouter.post(
  '/feedback',
  investigationLimit,
  requireRole('admin', 'analyst'),
  async (req, res, next) => {
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: 'Invalid investigation feedback', details: parsed.error.flatten() });
    try {
      ensureStorageAvailable();
      if (!(await getIncident(parsed.data.incidentId)))
        return res.status(404).json({ error: 'Incident not found' });
      const entry = {
        ...parsed.data,
        actorId: req.principal!.id,
        actorEmail: req.principal!.email,
      };
      if (databaseReady()) await InvestigationFeedbackModel.create(entry);
      else {
        memoryInvestigationFeedback.unshift({ ...entry, createdAt: new Date().toISOString() });
        if (memoryInvestigationFeedback.length > 20_000)
          memoryInvestigationFeedback.length = 20_000;
      }
      await writeAuditLog({
        actorId: req.principal!.id,
        actorEmail: req.principal!.email,
        action: 'investigation.feedback',
        resourceType: 'incident',
        resourceId: parsed.data.incidentId,
        details: { rating: parsed.data.rating },
      });
      return res.status(201).json({
        data: { accepted: true, rating: parsed.data.rating },
        mode: databaseReady() ? 'mongodb' : 'demo',
      });
    } catch (error) {
      return next(error);
    }
  },
);
