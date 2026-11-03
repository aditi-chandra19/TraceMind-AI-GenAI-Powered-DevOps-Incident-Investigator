import { AuditLogModel } from '../models/AuditLog.js';
import { databaseReady, ensureStorageAvailable, memoryAuditLogs } from './memoryStore.js';

export async function writeAuditLog(entry: {
  actorId?: string;
  actorEmail?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
}) {
  ensureStorageAvailable();
  if (databaseReady()) await AuditLogModel.create(entry);
  else {
    memoryAuditLogs.unshift({ ...entry, createdAt: new Date().toISOString() });
    if (memoryAuditLogs.length > 20_000) memoryAuditLogs.length = 20_000;
  }
}
