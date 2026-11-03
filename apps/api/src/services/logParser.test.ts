import { describe, expect, it } from 'vitest';
import { parseLogLine, redactSecrets } from './logParser.js';

describe('log parsing and redaction', () => {
  it('parses structured application logs while preserving the source line', () => {
    expect(
      parseLogLine('2026-11-03T10:00:00Z ERROR [checkout-api] database pool exhausted', 42),
    ).toEqual({
      lineNumber: 42,
      timestamp: '2026-11-03T10:00:00Z',
      level: 'error',
      service: 'checkout-api',
      message: 'database pool exhausted',
    });
  });

  it('parses Kubernetes event JSON without losing the event reason', () => {
    const parsed = parseLogLine(
      JSON.stringify({
        eventTime: '2026-11-03T10:05:00Z',
        type: 'Warning',
        reason: 'BackOff',
        involvedObject: { name: 'checkout-7' },
        message: 'Back-off restarting failed container',
      }),
      7,
    );
    expect(parsed).toMatchObject({
      lineNumber: 7,
      timestamp: '2026-11-03T10:05:00Z',
      level: 'warn',
      service: 'checkout-7',
      message: 'Back-off restarting failed container',
    });
  });

  it('redacts common credential formats', () => {
    const output = redactSecrets(
      "Authorization: Bearer abc.def_123 password='dont-share' sk-proj-123456789012 AKIA1234567890ABCDEF",
    );
    expect(output).not.toContain('abc.def_123');
    expect(output).not.toContain('dont-share');
    expect(output).not.toContain('sk-proj-123456789012');
    expect(output).not.toContain('AKIA1234567890ABCDEF');
  });
});
