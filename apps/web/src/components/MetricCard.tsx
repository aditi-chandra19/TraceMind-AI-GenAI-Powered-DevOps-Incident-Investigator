import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react';

export function MetricCard({
  label,
  value,
  trend: note,
  icon: Icon,
  accent,
  change,
  positive,
}: {
  label: string;
  value: string;
  trend: string;
  icon: LucideIcon;
  accent: string;
  change: string;
  positive?: boolean;
}) {
  return (
    <article className="panel metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <span className={`metric-icon ${accent}`}>
          <Icon size={16} />
        </span>
      </div>
      <div className="metric-value" dangerouslySetInnerHTML={{ __html: value }} />
      <div className="metric-bottom">
        <span className={`metric-change ${positive ? 'positive' : 'negative'}`}>
          {positive ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />} {change}
        </span>
        <span>{note}</span>
      </div>
      <div className={`metric-spark ${accent}`}>
        <svg viewBox="0 0 100 28" preserveAspectRatio="none">
          <path
            d={
              accent === 'red'
                ? 'M0 23 C10 22 16 21 25 20 S38 22 49 16 S60 21 68 12 S78 19 87 7 S95 13 100 3'
                : accent === 'amber'
                  ? 'M0 20 C12 18 16 10 25 13 S36 19 46 11 S55 20 66 12 S78 14 85 8 S94 13 100 6'
                  : accent === 'green'
                    ? 'M0 10 C8 11 18 14 27 12 S39 17 49 14 S58 18 68 12 S78 16 88 11 S95 13 100 8'
                    : 'M0 22 C9 20 17 23 26 16 S38 21 46 14 S58 18 66 10 S78 14 86 8 S94 12 100 4'
            }
          />
        </svg>
      </div>
    </article>
  );
}
