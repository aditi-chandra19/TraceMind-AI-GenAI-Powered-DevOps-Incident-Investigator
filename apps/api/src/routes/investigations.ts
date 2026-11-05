import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { writeAuditLog } from '../services/audit.js';
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
