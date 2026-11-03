import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { z } from "zod";
import { demoIncidents } from "./data/incidents.js";

export const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));
app.use(pinoHttp({ level: process.env.NODE_ENV === "test" ? "silent" : "info" }));
app.use("/api", rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false }));

app.get("/api/health", (_req, res) => res.json({ status: "ok", mode: "demo", timestamp: new Date().toISOString() }));

const querySchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(10), search: z.string().trim().max(120).optional(), severity: z.enum(["critical", "high", "medium", "low"]).optional(), status: z.enum(["investigating", "identified", "monitoring", "resolved"]).optional() });
app.get("/api/incidents", (req, res, next) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid query parameters", details: parsed.error.flatten() });
  try {
    const { page, limit, search, severity, status } = parsed.data;
    const needle = search?.toLowerCase();
    const filtered = demoIncidents.filter((incident) => (!severity || incident.severity === severity) && (!status || incident.status === status) && (!needle || `${incident.id} ${incident.title} ${incident.service}`.toLowerCase().includes(needle)));
    const start = (page - 1) * limit;
    return res.json({ data: filtered.slice(start, start + limit), pagination: { page, limit, total: filtered.length, pages: Math.ceil(filtered.length / limit) }, mode: "demo" });
  } catch (error) { return next(error); }
});
app.get("/api/incidents/:id", (req, res) => {
  const incident = demoIncidents.find((item) => item.id === req.params.id);
  if (!incident) return res.status(404).json({ error: "Incident not found" });
  return res.json({ data: incident, mode: "demo" });
});
app.get("/api/overview", (_req, res) => {
  const active = demoIncidents.filter((incident) => incident.status !== "resolved");
  res.json({ data: { active: active.length, critical: active.filter((incident) => incident.severity === "critical").length, affectedUsers: "3.6k", mttr: "42m", incidents: demoIncidents } });
});

app.use(((error: unknown, req, res, _next) => {
  req.log?.error({ err: error }, "Unhandled API error");
  res.status(500).json({ error: "Internal server error" });
}) as ErrorRequestHandler);
