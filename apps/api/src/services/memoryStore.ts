import type { Incident } from "../types.js";
import { demoIncidents } from "../data/incidents.js";

export interface MemoryUser { id: string; name: string; email: string; passwordHash: string; role: "admin" | "analyst" | "viewer"; disabled: boolean }
export interface StoredLog { sourceId: string; lineNumber: number; incidentId?: string; timestamp?: string; level?: string; service?: string; message: string }
export interface MemoryLogSource { id: string; originalName: string; sizeBytes: number; lineCount: number; incidentId?: string; uploadedBy: string; redacted: true; format: "jsonl" | "json" | "text"; createdAt: string }
export interface MemoryAuditEntry { actorId?: string; actorEmail?: string; action: string; resourceType: string; resourceId?: string; details?: Record<string, unknown>; createdAt: string }

export const memoryUsers = new Map<string, MemoryUser>();
export const memoryIncidents: Incident[] = structuredClone(demoIncidents);
export const memoryLogs: StoredLog[] = [];
export const memorySources: MemoryLogSource[] = [];
export const memoryAuditLogs: MemoryAuditEntry[] = [];
export const MAX_MEMORY_LOG_ENTRIES = 100_000;

export function databaseReady() { return Boolean(process.env.MONGODB_URI) && (globalThis as typeof globalThis & { __traceMindMongoReady?: boolean }).__traceMindMongoReady === true; }
export function ensureStorageAvailable() {
  if (!databaseReady() && process.env.NODE_ENV === "production" && process.env.DEMO_MODE !== "true") throw new Error("MongoDB is unavailable and demo fallback is disabled.");
}
