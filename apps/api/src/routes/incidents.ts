import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { IncidentModel } from '../models/Incident.js';
import {
  createIncident,
  findSimilarIncidents,
  getIncident,
  listIncidents,
} from '../services/incidents.js';
import { databaseReady } from '../services/memoryStore.js';
import { writeAuditLog } from '../services/audit.js';

export const incidentRouter = Router();
incidentRouter.use(requireAuth);

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(120).optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  status: z.enum(['investigating', 'identified', 'monitoring', 'resolved']).optional(),
});
const createSchema = z.object({
  title: z.string().trim().min(5).max(180),
  service: z.string().trim().min(1).max(100),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  summary: z.string().trim().max(4000).optional(),
  status: z.enum(['investigating', 'identified', 'monitoring', 'resolved']).optional(),
});

incidentRouter.get('/', async (req, res, next) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success)
    return res
      .status(400)
      .json({ error: 'Invalid query parameters', details: parsed.error.flatten() });
  try {
    return res.json(await listIncidents(parsed.data));
  } catch (error) {
    return next(error);
  }
});
incidentRouter.get('/:id/similar', async (req, res, next) => {
  const parsed = z
    .object({ limit: z.coerce.number().int().min(1).max(10).default(5) })
    .safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid query parameters' });
  try {
    const id = Array.isArray(req.params.id) ? (req.params.id[0] ?? '') : (req.params.id ?? '');
    const result = await findSimilarIncidents(id, parsed.data.limit);
    if (!result) return res.status(404).json({ error: 'Incident not found' });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});
incidentRouter.get('/:id', async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? (req.params.id[0] ?? '') : (req.params.id ?? '');
    const incident = await getIncident(id);
    if (!incident) return res.status(404).json({ error: 'Incident not found' });
    return res.json({ data: incident, mode: databaseReady() ? 'mongodb' : 'demo' });
  } catch (error) {
    return next(error);
  }
});

incidentRouter.post('/', requireRole('admin', 'analyst'), async (req, res, next) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success)
    return res
      .status(400)
      .json({ error: 'Invalid incident details', details: parsed.error.flatten() });
  try {
    const incident = await createIncident(parsed.data);
    await writeAuditLog({
      actorId: req.principal!.id,
      actorEmail: req.principal!.email,
      action: 'incident.create',
      resourceType: 'incident',
      resourceId: incident.id,
    });
    return res.status(201).json({ data: incident, mode: databaseReady() ? 'mongodb' : 'demo' });
  } catch (error) {
    return next(error);
  }
});

incidentRouter.patch('/:id/status', requireRole('admin', 'analyst'), async (req, res, next) => {
  const parsed = z
    .object({ status: z.enum(['investigating', 'identified', 'monitoring', 'resolved']) })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid status' });
  try {
    if (databaseReady()) {
      const id = Array.isArray(req.params.id) ? (req.params.id[0] ?? '') : (req.params.id ?? '');
      const updated = await IncidentModel.findOneAndUpdate(
        { id },
        { $set: { status: parsed.data.status } },
        { new: true },
      ).lean();
      if (!updated) return res.status(404).json({ error: 'Incident not found' });
      await writeAuditLog({
        actorId: req.principal!.id,
        actorEmail: req.principal!.email,
        action: 'incident.status.update',
        resourceType: 'incident',
        resourceId: updated.id,
        details: { status: updated.status },
      });
      return res.json({ data: updated, mode: 'mongodb' });
    }
    const id = Array.isArray(req.params.id) ? (req.params.id[0] ?? '') : (req.params.id ?? '');
    const incident = await getIncident(id);
    if (!incident) return res.status(404).json({ error: 'Incident not found' });
    incident.status = parsed.data.status;
    incident.timeline.push({
      time: new Date().toISOString(),
      title: 'Status updated',
      detail: `Status set to ${parsed.data.status} by ${req.principal!.email}.`,
      kind: 'action',
    });
    await writeAuditLog({
      actorId: req.principal!.id,
      actorEmail: req.principal!.email,
      action: 'incident.status.update',
      resourceType: 'incident',
      resourceId: incident.id,
      details: { status: incident.status },
    });
    return res.json({ data: incident, mode: 'demo' });
  } catch (error) {
    return next(error);
  }
});
