import { describe, expect, it } from 'vitest';
import { buildLocalLogAnalysis } from './logAnalysis.js';
import { redactSensitiveForExternalAi } from './logParser.js';

describe('evidence-backed log analysis', () => {
  it('clusters repeated errors and cites only supplied source lines', () => {
    const result = buildLocalLogAnalysis([
      { lineNumber: 10, level: 'error', message: 'database pool exhausted for request 1001' },
      { lineNumber: 11, level: 'error', message: 'database pool exhausted for request 1002' },
      { lineNumber: 12, message: '    at connect (db.js:44:2)' },
      { lineNumber: 13, level: 'info', message: 'request completed' },
    ]);
    expect(result.severity).toBe('medium');
    expect(result.errorClusters[0]).toMatchObject({ count: 2, lineNumbers: [10, 11] });
    expect(result.stackTraceLineNumbers).toEqual([12]);
    expect(result.evidenceLineNumbers).toEqual([10, 11, 12]);
    expect(result.rootCauseHypothesis).toMatch(/connection pool pressure is a possible cause/i);
  });

  it('reports uncertainty and avoids claiming evidence when no errors exist', () => {
    const result = buildLocalLogAnalysis([{ lineNumber: 4, level: 'info', message: 'started' }]);
    expect(result.severity).toBe('low');
    expect(result.confidence).toBe(18);
    expect(result.evidenceLineNumbers).toEqual([]);
    expect(result.rootCauseHypothesis).toMatch(/no clear error signature/i);
  });

  it('removes secrets and common personal identifiers before external model calls', () => {
    const safe = redactSensitiveForExternalAi(
      'user=alex@example.com from 203.0.113.8 phone +1 555 123 4567 access_token=super-secret-token',
    );
    expect(safe).not.toContain('alex@example.com');
    expect(safe).not.toContain('203.0.113.8');
    expect(safe).not.toContain('+1 555 123 4567');
    expect(safe).not.toContain('super-secret-token');
  });
});
