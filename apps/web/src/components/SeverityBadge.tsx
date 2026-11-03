import type { Severity } from '../types';

function severityLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`severity severity-${severity}`}>
      <span /> {severityLabel(severity)}
    </span>
  );
}
