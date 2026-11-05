import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { LogEntryModel } from '../models/LogEntry.js';
import { LogSourceModel } from '../models/LogSource.js';
import {
  databaseReady,
  ensureStorageAvailable,
  memoryLogs,
  memorySources,
  MAX_MEMORY_LOG_ENTRIES,
  type MemoryLogSource,
  type StoredLog,
} from './memoryStore.js';
import { inferLogFormat, parseLogLine, redactSecrets, type LogFormat } from './logParser.js';
import { maxLogLineBytes, maxLogLines } from '../config/limits.js';

export interface IngestionResult {
  source: {
    id: string;
    originalName: string;
    sizeBytes: number;
    lineCount: number;
    incidentId?: string;
    format: LogFormat;
    redacted: true;
  };
  stored: number;
  errors: number;
}
export class LogIngestionError extends Error {
  constructor(
    message: string,
    readonly status = 413,
  ) {
    super(message);
  }
}

function safeFileName(input: string) {
  const leaf = input.replace(/\\/g, '/').split('/').pop() ?? 'upload.log';
  return redactSecrets(leaf.replace(/[\u0000-\u001f\u007f]/g, '')).slice(0, 180) || 'upload.log';
}

export async function ingestLogStream(
  stream: NodeJS.ReadableStream,
  options: { fileName: string; incidentId?: string; uploadedBy: string; maxLines?: number },
): Promise<IngestionResult> {
  ensureStorageAvailable();
  const originalName = safeFileName(options.fileName);
  const format = inferLogFormat(originalName);
  const maxLines = options.maxLines ?? maxLogLines;
  const sourceObjectId = new Types.ObjectId();
  const sourceId = databaseReady() ? sourceObjectId.toHexString() : randomUUID();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const batch: StoredLog[] = [];
  let pending = '';
  let lineNumber = 0;
  let sizeBytes = 0;
  let stored = 0;

  const persistBatch = async () => {
    if (!batch.length) return;
    if (databaseReady())
      await LogEntryModel.insertMany(
        batch.map((entry) => ({ ...entry, sourceId: sourceObjectId })),
        { ordered: true },
      );
    else {
      if (memoryLogs.length + batch.length > MAX_MEMORY_LOG_ENTRIES)
        throw new Error(
          'Demo log capacity has been reached. Configure MongoDB to retain larger uploads.',
        );
      memoryLogs.push(...batch);
    }
    stored += batch.length;
    batch.length = 0;
  };

  const acceptLine = async (raw: string) => {
    lineNumber += 1;
    if (lineNumber > maxLines)
      throw new LogIngestionError(`Log contains more than ${maxLines.toLocaleString()} lines.`);
    if (Buffer.byteLength(raw, 'utf8') > maxLogLineBytes)
      throw new LogIngestionError('A log line exceeds the 64 KiB line limit.');
    const parsed = parseLogLine(raw, lineNumber);
    if (!parsed) return;
    batch.push({
      sourceId,
      lineNumber: parsed.lineNumber,
      incidentId: options.incidentId,
      timestamp: parsed.timestamp,
      level: parsed.level,
      service: parsed.service,
      message: parsed.message,
    });
    if (batch.length >= 250) await persistBatch();
  };

  try {
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      const bytes = Buffer.from(chunk);
      sizeBytes += bytes.byteLength;
      const text = pending + decoder.decode(bytes, { stream: true });
      const lines = text.split('\n');
      pending = lines.pop() ?? '';
      if (Buffer.byteLength(pending, 'utf8') > maxLogLineBytes)
        throw new LogIngestionError('A log line exceeds the 64 KiB line limit.');
      for (const line of lines) await acceptLine(line);
    }
    if ((stream as NodeJS.ReadableStream & { truncated?: boolean }).truncated)
      throw new LogIngestionError('File exceeds the configured upload limit.');
    pending += decoder.decode();
    if (pending) await acceptLine(pending);
    await persistBatch();

    const source: IngestionResult['source'] = {
      id: sourceId,
      originalName,
      sizeBytes,
      lineCount: lineNumber,
      incidentId: options.incidentId,
      format,
      redacted: true,
    };
    if (databaseReady())
      await LogSourceModel.create({
        _id: sourceObjectId,
        originalName,
        sizeBytes,
        lineCount: lineNumber,
        incidentId: options.incidentId,
        uploadedBy: options.uploadedBy === 'demo-admin' ? undefined : options.uploadedBy,
        redacted: true,
        format,
      });
    else
      memorySources.unshift({
        ...source,
        uploadedBy: options.uploadedBy,
        createdAt: new Date().toISOString(),
      } satisfies MemoryLogSource);
    return { source, stored, errors: 0 };
  } catch (error) {
    await discardLogSource(sourceId).catch(() => undefined);
    throw error;
  }
}

export async function discardLogSource(sourceId: string) {
  if (databaseReady() && Types.ObjectId.isValid(sourceId)) {
    const objectId = new Types.ObjectId(sourceId);
    await Promise.all([
      LogEntryModel.deleteMany({ sourceId: objectId }),
      LogSourceModel.deleteOne({ _id: objectId }),
    ]);
  } else {
    for (let index = memoryLogs.length - 1; index >= 0; index -= 1)
      if (memoryLogs[index]?.sourceId === sourceId) memoryLogs.splice(index, 1);
    const sourceIndex = memorySources.findIndex((source) => source.id === sourceId);
    if (sourceIndex >= 0) memorySources.splice(sourceIndex, 1);
  }
}

export async function listLogSources(limit: number) {
  ensureStorageAvailable();
  if (databaseReady()) return LogSourceModel.find().sort({ createdAt: -1 }).limit(limit).lean();
  return memorySources.slice(0, limit);
}

export async function getLogSource(sourceId: string) {
  ensureStorageAvailable();
  if (databaseReady()) {
    if (!Types.ObjectId.isValid(sourceId)) return null;
    return LogSourceModel.findById(sourceId).lean();
  }
  return memorySources.find((source) => source.id === sourceId) ?? null;
}

export async function listSourceLogs(sourceId: string, page: number, limit: number) {
  ensureStorageAvailable();
  if (databaseReady()) {
    if (!Types.ObjectId.isValid(sourceId))
      return { data: [], pagination: { page, limit, total: 0, pages: 0 } };
    const query = { sourceId: new Types.ObjectId(sourceId) };
    const [data, total] = await Promise.all([
      LogEntryModel.find(query)
        .sort({ lineNumber: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      LogEntryModel.countDocuments(query),
    ]);
    return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }
  const matched = memoryLogs.filter((entry) => entry.sourceId === sourceId);
  const start = (page - 1) * limit;
  return {
    data: matched.slice(start, start + limit),
    pagination: { page, limit, total: matched.length, pages: Math.ceil(matched.length / limit) },
  };
}
