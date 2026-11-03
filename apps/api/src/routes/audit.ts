import { Router } from "express";
import { z } from "zod";
import { AuditLogModel } from "../models/AuditLog.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { databaseReady, ensureStorageAvailable, memoryAuditLogs } from "../services/memoryStore.js";

export const auditRouter = Router();
auditRouter.use(requireAuth, requireRole("admin"));

auditRouter.get("/", async (req, res, next) => {
  const parsed = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25), action: z.string().trim().max(100).optional() }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid query parameters" });
  const { page, limit, action } = parsed.data;
  try {
    ensureStorageAvailable();
    if (databaseReady()) {
      const filter = action ? { action } : {};
      const [data, total] = await Promise.all([AuditLogModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), AuditLogModel.countDocuments(filter)]);
      return res.json({ data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    }
    const filtered = memoryAuditLogs.filter((entry) => !action || entry.action === action);
    const start = (page - 1) * limit;
    return res.json({ data: filtered.slice(start, start + limit), pagination: { page, limit, total: filtered.length, pages: Math.ceil(filtered.length / limit) }, mode: "demo" });
  } catch (error) { return next(error); }
});
