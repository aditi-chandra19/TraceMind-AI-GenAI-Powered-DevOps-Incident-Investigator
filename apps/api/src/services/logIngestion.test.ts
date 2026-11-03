import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { memoryLogs, memorySources } from './memoryStore.js';
import { ingestLogStream } from './logIngestion.js';

afterEach(() => {
  memoryLogs.splice(0);
  memorySources.splice(0);
});

describe('streaming log ingestion', () => {
  it('keeps only redacted records and safe filenames in demo storage', async () => {
    const chunks = [
      Buffer.from('INFO secret=first'),
      Buffer.from('-value\n'),
      Buffer.from('ERROR service failed\n'),
    ];
    const result = await ingestLogStream(Readable.from(chunks), {
      fileName: '../../private.log',
      uploadedBy: 'demo-admin',
    });
    expect(result.source.originalName).toBe('private.log');
    expect(result.source.lineCount).toBe(2);
    expect(memoryLogs.map((entry) => entry.message)).toEqual([
      'INFO secret=[REDACTED]',
      'ERROR service failed',
    ]);
    expect(JSON.stringify(memoryLogs)).not.toContain('first-value');
  });

  it('removes already-flushed batches when a line-count limit is exceeded', async () => {
    await expect(
      ingestLogStream(Readable.from(['one\n'.repeat(251)]), {
        fileName: 'too-many.log',
        uploadedBy: 'demo-admin',
        maxLines: 250,
      }),
    ).rejects.toThrow('more than 250 lines');
    expect(memoryLogs).toHaveLength(0);
    expect(memorySources).toHaveLength(0);
  });

  it('rejects oversized individual lines and cleans partial state', async () => {
    const oversized = `${'x'.repeat(64 * 1024 + 1)}\n`;
    await expect(
      ingestLogStream(Readable.from([oversized]), {
        fileName: 'large-line.log',
        uploadedBy: 'demo-admin',
      }),
    ).rejects.toThrow('64 KiB');
    expect(memoryLogs).toHaveLength(0);
  });
});
