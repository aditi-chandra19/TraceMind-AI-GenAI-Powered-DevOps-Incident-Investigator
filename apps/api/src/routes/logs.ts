import { Router } from 'express';
import busboy from 'busboy';
import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  listLogSources,
  listSourceLogs,
  ingestLogStream,
  discardLogSource,
  LogIngestionError,
  type IngestionResult,
} from '../services/logIngestion.js';
import { databaseReady } from '../services/memoryStore.js';
import { maxUploadBytes, maxUploadMb } from '../config/limits.js';
import { writeAuditLog } from '../services/audit.js';
import { analyzeLogSource, LogAnalysisError } from '../services/logAnalysis.js';

export const logRouter = Router();
logRouter.use(requireAuth);

class UploadError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
const uploadLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});
const analysisLimit = rateLimit({
  windowMs: 60 * 60_000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});
const allowedExtension = /\.(log|txt|json|jsonl|ndjson)$/i;

logRouter.post('/upload', uploadLimit, requireRole('admin', 'analyst'), (req, res, next) => {
  if (!req.is('multipart/form-data'))
    return res.status(415).json({ error: 'Upload must use multipart/form-data' });
  const incidentId = z.string().trim().max(40).optional().safeParse(req.query.incidentId);
  if (!incidentId.success) return res.status(400).json({ error: 'Invalid incident id' });
  let parser: ReturnType<typeof busboy>;
  try {
    parser = busboy({
      headers: req.headers,
      limits: { files: 1, fileSize: maxUploadBytes, fields: 2, parts: 3 },
    });
  } catch {
    return res.status(400).json({ error: 'Invalid multipart upload' });
  }

  let fileSeen = false;
  let tooLarge = false;
  let parseError: Error | undefined;
  let uploadPromise: Promise<IngestionResult> | undefined;
  parser.on('file', (fieldName, stream, info) => {
    if (fieldName !== 'file' || fileSeen) {
      parseError = new UploadError("Upload exactly one file in the 'file' field", 400);
      stream.resume();
      return;
    }
    fileSeen = true;
    const fileName = (info.filename || 'upload.log')
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .slice(0, 180);
    if (!allowedExtension.test(fileName)) {
      parseError = new UploadError(
        'Supported file types are .log, .txt, .json, .jsonl, and .ndjson',
        415,
      );
      stream.resume();
      return;
    }
    stream.on('limit', () => {
      tooLarge = true;
    });
    uploadPromise = ingestLogStream(stream, {
      fileName,
      incidentId: incidentId.data,
      uploadedBy: req.principal!.id,
    });
    uploadPromise.catch((error: unknown) => {
      parseError = error instanceof Error ? error : new Error('Unable to parse uploaded log');
    });
  });
  parser.on('filesLimit', () => {
    parseError = new UploadError('Only one log file can be uploaded at a time', 400);
  });
  parser.on('fieldsLimit', () => {
    parseError = new UploadError('Too many multipart fields', 400);
  });
  parser.on('partsLimit', () => {
    parseError = new UploadError('Too many multipart parts', 400);
  });
  parser.on('error', (error) => next(error));
  parser.on('close', async () => {
    if (tooLarge) {
      const completed = await uploadPromise?.catch(() => undefined);
      if (completed) await discardLogSource(completed.source.id).catch(() => undefined);
      return res.status(413).json({ error: `File exceeds the ${maxUploadMb} MB upload limit` });
    }
    if (parseError) {
      const completed = await uploadPromise?.catch(() => undefined);
      if (completed) await discardLogSource(completed.source.id).catch(() => undefined);
      const status =
        parseError instanceof UploadError || parseError instanceof LogIngestionError
          ? parseError.status
          : 400;
      return res.status(status).json({ error: parseError.message });
    }
    if (!fileSeen || !uploadPromise)
      return res.status(400).json({ error: 'No log file was provided' });
    try {
      const result = await uploadPromise;
      await writeAuditLog({
        actorId: req.principal!.id,
        actorEmail: req.principal!.email,
        action: 'log.upload',
        resourceType: 'log-source',
        resourceId: result.source.id,
        details: {
          fileName: result.source.originalName,
          sizeBytes: result.source.sizeBytes,
          lineCount: result.source.lineCount,
          redacted: true,
        },
      });
      return res.status(201).json({ data: result, mode: databaseReady() ? 'mongodb' : 'demo' });
    } catch (error) {
      return next(error);
    }
  });
  req.pipe(parser);
});

logRouter.get('/sources', async (req, res, next) => {
  const query = z
    .object({ limit: z.coerce.number().int().min(1).max(100).default(20) })
    .safeParse(req.query);
  if (!query.success) return res.status(400).json({ error: 'Invalid query parameters' });
  try {
    return res.json({ data: await listLogSources(query.data.limit) });
  } catch (error) {
    return next(error);
  }
});

logRouter.get('/sources/:id/entries', async (req: Request, res, next) => {
  const query = z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(500).default(100),
    })
    .safeParse(req.query);
  if (!query.success) return res.status(400).json({ error: 'Invalid query parameters' });
  const sourceId = Array.isArray(req.params.id) ? (req.params.id[0] ?? '') : (req.params.id ?? '');
  try {
    return res.json(await listSourceLogs(sourceId, query.data.page, query.data.limit));
  } catch (error) {
    return next(error);
  }
});

logRouter.post(
  '/sources/:id/analyze',
  analysisLimit,
  requireRole('admin', 'analyst'),
  async (req: Request, res, next) => {
    const sourceId = Array.isArray(req.params.id)
      ? (req.params.id[0] ?? '')
      : (req.params.id ?? '');
    try {
      const analysis = await analyzeLogSource(sourceId);
      await writeAuditLog({
        actorId: req.principal!.id,
        actorEmail: req.principal!.email,
        action: 'log.analyze',
        resourceType: 'log-source',
        resourceId: sourceId,
        details: {
          analyzedLines: analysis.source.analyzedLines,
          analysisMode: analysis.analysisMode,
          severity: analysis.severity,
          confidence: analysis.confidence,
        },
      });
      return res.json({ data: analysis, mode: databaseReady() ? 'mongodb' : 'demo' });
    } catch (error) {
      if (error instanceof LogAnalysisError)
        return res.status(error.status).json({ error: error.message });
      return next(error);
    }
  },
);
