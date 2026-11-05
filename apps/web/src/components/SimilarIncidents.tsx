import { useState } from 'react';
import { ArrowUpRight, GitCompareArrows, LoaderCircle } from 'lucide-react';
import { getSimilarIncidents, type SimilarIncident } from '../api';

export function SimilarIncidents({
  incidentId,
  onSelect,
}: {
  incidentId: string;
  onSelect: (id: string) => void;
}) {
  const [results, setResults] = useState<SimilarIncident[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setResults(await getSimilarIncidents(incidentId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not find similar incidents.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="similar-incidents" aria-label="Similar incidents">
      <div className="similar-heading">
        <div>
          <b>Related incidents</b>
          <small>Matched by service, severity, and incident text</small>
        </div>
        <button className="dialog-secondary" onClick={() => void load()} disabled={loading}>
          {loading ? <LoaderCircle className="spin" size={14} /> : <GitCompareArrows size={14} />}
          {results ? 'Refresh' : 'Find similar'}
        </button>
      </div>
      {error && (
        <p className="chat-error" role="alert">
          {error}
        </p>
      )}
      {results &&
        (results.length ? (
          <div className="similar-list">
            {results.map(({ incident, similarityScore, reasons }) => (
              <button
                className="similar-row"
                key={incident.id}
                onClick={() => onSelect(incident.id)}
              >
                <span>
                  <b>
                    {incident.id} · {incident.title}
                  </b>
                  <small>
                    {incident.service} · {reasons.join(' · ')}
                  </small>
                </span>
                <span className="similar-score">
                  {similarityScore}% <ArrowUpRight size={13} />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="panel-feedback">No related incidents were found.</p>
        ))}
    </section>
  );
}
