import { useEffect, useState } from 'react';
import { getInvestigationFeedback, type InvestigationFeedbackEntry } from '../api';

export function FeedbackInbox() {
  const [items, setItems] = useState<InvestigationFeedbackEntry[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    getInvestigationFeedback()
      .then(setItems)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'Could not load feedback.');
      });
  }, []);
  return (
    <section className="feedback-inbox" aria-label="Recent investigation feedback">
      <h3>Recent investigation feedback</h3>
      {error && (
        <p className="chat-error" role="alert">
          {error}
        </p>
      )}
      {!error && items.length === 0 && (
        <p className="panel-feedback">No feedback has been submitted yet.</p>
      )}
      {items.map((item, index) => (
        <article key={`${item.incidentId}-${item.createdAt}-${index}`}>
          <span>
            <b>{item.rating === 'helpful' ? 'Helpful' : 'Needs work'}</b> · {item.incidentId} ·{' '}
            {item.actorEmail}
          </span>
          {item.comment && <p>{item.comment}</p>}
          <small>{new Date(item.createdAt).toLocaleString()}</small>
        </article>
      ))}
    </section>
  );
}
