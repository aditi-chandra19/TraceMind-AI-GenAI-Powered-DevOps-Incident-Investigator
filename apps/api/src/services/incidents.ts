import { randomUUID } from "node:crypto";
import { IncidentModel } from "../models/Incident.js";
import { memoryIncidents, databaseReady, ensureStorageAvailable } from "./memoryStore.js";
import type { Incident } from "../types.js";

export interface IncidentFilter { page: number; limit: number; search?: string; severity?: Incident["severity"]; status?: Incident["status"] }

export async function listIncidents(filter: IncidentFilter) {
  ensureStorageAvailable();
  if (databaseReady()) {
    const query: Record<string, unknown> = {};
    if (filter.severity) query.severity = filter.severity;
    if (filter.status) query.status = filter.status;
    if (filter.search) query.$or = ["id", "title", "service"].map((field) => ({ [field]: { $regex: filter.search!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } }));
    const [data, total] = await Promise.all([IncidentModel.find(query).sort({ startedAt: -1 }).skip((filter.page - 1) * filter.limit).limit(filter.limit).lean(), IncidentModel.countDocuments(query)]);
    return { data, pagination: { page: filter.page, limit: filter.limit, total, pages: Math.ceil(total / filter.limit) }, mode: "mongodb" as const };
  }
  const search = filter.search?.toLowerCase();
  const matches = memoryIncidents.filter((incident) => (!filter.severity || incident.severity === filter.severity) && (!filter.status || incident.status === filter.status) && (!search || `${incident.id} ${incident.title} ${incident.service}`.toLowerCase().includes(search)));
  const start = (filter.page - 1) * filter.limit;
  return { data: matches.slice(start, start + filter.limit), pagination: { page: filter.page, limit: filter.limit, total: matches.length, pages: Math.ceil(matches.length / filter.limit) }, mode: "demo" as const };
}

export async function getIncident(id: string) {
  ensureStorageAvailable();
  if (databaseReady()) return IncidentModel.findOne({ id }).lean();
  return memoryIncidents.find((incident) => incident.id === id) ?? null;
}

export async function createIncident(input: Pick<Incident, "title" | "service" | "severity"> & Partial<Pick<Incident, "summary" | "status">>) {
  ensureStorageAvailable();
  const incident: Incident = { id: `INC-${randomUUID().slice(0, 8).toUpperCase()}`, title: input.title, service: input.service, severity: input.severity, status: input.status ?? "investigating", startedAt: new Date().toISOString(), duration: "just now", affectedUsers: "0", summary: input.summary ?? "", rootCause: "Under investigation", confidence: 0, signals: [], timeline: [{ time: new Date().toISOString(), title: "Incident created", detail: "Incident created by an authenticated investigator.", kind: "alert" }] };
  if (databaseReady()) return (await IncidentModel.create(incident)).toObject();
  memoryIncidents.unshift(incident);
  return incident;
}

export async function seedIncidents() {
  if (!databaseReady()) return;
  for (const incident of memoryIncidents.slice(-4)) {
    await IncidentModel.collection.updateOne({ id: incident.id }, { $setOnInsert: incident as unknown as Record<string, unknown> }, { upsert: true });
  }
}
