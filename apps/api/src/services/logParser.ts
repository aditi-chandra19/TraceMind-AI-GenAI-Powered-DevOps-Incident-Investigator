export type LogFormat = 'jsonl' | 'json' | 'text';
export interface ParsedLogLine {
  lineNumber: number;
  timestamp?: string;
  level?: string;
  service?: string;
  message: string;
}

const secretPatterns: RegExp[] = [
  /\b(authorization\s*:\s*bearer)\s+[^\s,;]+/gi,
  /\b(bearer)\s+[A-Za-z0-9._~+\/-]+=*/gi,
  /\b(password|passwd|pwd|secret|client_secret|api[_-]?key|access[_-]?token|refresh[_-]?token)\b(\s*[=:]\s*)("[^"]*"|'[^']*'|[^\s,;]+)/gi,
  /\b(sk-[A-Za-z0-9_-]{12,})\b/g,
  /\b(AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{20,})\b/g,
  /\b(mongodb(?:\+srv)?:\/\/)[^:@/\s]+:[^@/\s]+@/gi,
];

export function redactSecrets(input: string): string {
  let safe = input;
  safe = safe.replace(secretPatterns[0]!, '$1 [REDACTED]');
  safe = safe.replace(secretPatterns[1]!, '$1 [REDACTED]');
  safe = safe.replace(secretPatterns[2]!, '$1$2[REDACTED]');
  safe = safe.replace(secretPatterns[3]!, '[REDACTED_API_KEY]');
  safe = safe.replace(secretPatterns[4]!, '[REDACTED_CREDENTIAL]');
  safe = safe.replace(secretPatterns[5]!, '$1[REDACTED]@');
  return safe;
}

export function redactSensitiveForExternalAi(input: string): string {
  return redactSecrets(input)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[REDACTED_IP]')
    .replace(/\+\d{1,3}[ .-]\d{5}[ .-]\d{5}\b/g, '[REDACTED_PHONE]')
    .replace(/\b(?:\+?1[ .-])?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b/g, '[REDACTED_PHONE]')
    .replace(/\b(?:\d[ -]?){13,19}\b/g, '[REDACTED_CARD]');
}

function normalizeLevel(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined;
  const value = input.trim().toLowerCase();
  if (
    ['fatal', 'critical', 'error', 'err', 'warn', 'warning', 'info', 'debug', 'trace'].includes(
      value,
    )
  )
    return value === 'err' ? 'error' : value === 'warning' ? 'warn' : value;
  return undefined;
}

export function parseLogLine(input: string, lineNumber: number): ParsedLogLine | null {
  const line = input.replace(/\r$/, '');
  if (!line.trim()) return null;
  try {
    const value: unknown = JSON.parse(line);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const data = value as Record<string, unknown>;
      const messageValue =
        data.message ?? data.msg ?? data.log ?? data.reason ?? data.event ?? line;
      const message =
        typeof messageValue === 'string' ? messageValue : JSON.stringify(messageValue);
      const timestamp = [
        data.timestamp,
        data.time,
        data.ts,
        data.eventTime,
        data.lastTimestamp,
      ].find((item) => typeof item === 'string' || typeof item === 'number');
      const service = [
        data.service,
        data.service_name,
        data.app,
        data.container,
        data.pod,
        data.involvedObject && typeof data.involvedObject === 'object'
          ? (data.involvedObject as Record<string, unknown>).name
          : undefined,
      ].find((item) => typeof item === 'string');
      const level = normalizeLevel(data.level ?? data.severity ?? data.type);
      return {
        lineNumber,
        timestamp:
          timestamp === undefined ? undefined : redactSecrets(String(timestamp)).slice(0, 100),
        level,
        service: typeof service === 'string' ? redactSecrets(service).slice(0, 160) : undefined,
        message: redactSecrets(message).slice(0, 12_000),
      };
    }
  } catch {
    /* Plain application logs are parsed below. */
  }

  const match = line.match(
    /^((?:\d{4}-\d{2}-\d{2}T\S+)|(?:\S+\s+\S+))\s+(TRACE|DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL|CRITICAL)\s+(?:\[([^\]]+)\]\s*)?(.*)$/i,
  );
  if (match)
    return {
      lineNumber,
      timestamp: redactSecrets(match[1]!).slice(0, 100),
      level: normalizeLevel(match[2]),
      service: match[3] ? redactSecrets(match[3]).slice(0, 160) : undefined,
      message: redactSecrets(match[4] || line).slice(0, 12_000),
    };
  const levelMatch = line.match(/\b(TRACE|DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL|CRITICAL)\b/i);
  return {
    lineNumber,
    level: normalizeLevel(levelMatch?.[1]),
    message: redactSecrets(line).slice(0, 12_000),
  };
}

export function inferLogFormat(fileName: string): LogFormat {
  const ext = fileName.toLowerCase().split('.').pop();
  return ext === 'jsonl' || ext === 'ndjson' ? 'jsonl' : ext === 'json' ? 'json' : 'text';
}
