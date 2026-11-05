import { afterEach, describe, expect, it } from 'vitest';
import { searchKnowledge } from './retrieval.js';

const originalKey = process.env.OPENAI_API_KEY;
afterEach(() => {
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
});

describe('retrieval quality checks (local keyword evaluation set)', () => {
  it.each([
    ['database connection pool saturation and checkout latency', 'db-pool-checks'],
    ['Kubernetes CrashLoopBackOff pod restart events and probe failure', 'kubernetes-restarts'],
    ['downstream request timeout and retry volume', 'request-timeouts'],
  ])('ranks the expected runbook for %s', async (query, expectedId) => {
    delete process.env.OPENAI_API_KEY;
    const result = await searchKnowledge(query, 3);
    expect(result.mode).toBe('keyword');
    expect(result.results[0]?.id).toBe(expectedId);
    expect(result.results[0]?.lineStart).toBeGreaterThan(0);
    expect(result.results[0]?.sourcePath).toMatch(/^runbook:\/\//);
  });
});
