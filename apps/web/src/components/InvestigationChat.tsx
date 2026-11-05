import { useState, type FormEvent } from 'react';
import { ArrowUp, BookOpen, LoaderCircle, MessageSquareText, ShieldCheck } from 'lucide-react';
import { sendInvestigationMessage, type InvestigationReply, type InvestigationTurn } from '../api';
import type { Incident } from '../types';

export function InvestigationChat({ incident }: { incident: Incident }) {
  const [turns, setTurns] = useState<InvestigationTurn[]>([]);
  const [reply, setReply] = useState<InvestigationReply | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const question = message.trim();
    if (!question || busy) return;
    const updated = [...turns, { role: 'user' as const, content: question }];
    setTurns(updated);
    setMessage('');
    setBusy(true);
    setError('');
    try {
      const result = await sendInvestigationMessage(incident.id, question, turns.slice(-8));
      setReply(result);
      setTurns([...updated, { role: 'assistant', content: result.answer }]);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not send your investigation question.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="investigation-chat" aria-label="Incident investigation chat">
      <div className="chat-heading">
        <span className="chat-icon">
          <MessageSquareText size={17} />
        </span>
        <div>
          <b>Ask about this incident</b>
          <small>Answers use this incident and retrieved runbooks</small>
        </div>
      </div>
      {turns.length > 0 && (
        <div className="chat-transcript" aria-live="polite">
          {turns.map((turn, index) => (
            <p className={`chat-turn ${turn.role}`} key={`${index}-${turn.role}`}>
              <b>{turn.role === 'user' ? 'You' : 'TraceMind'}</b>
              {turn.content}
            </p>
          ))}
        </div>
      )}
      {reply && (
        <div className="chat-answer">
          <div className="chat-mode">
            {reply.mode === 'openai' ? 'AI assisted' : 'Local grounded response'} ·{' '}
            {reply.retrievalMode} retrieval
          </div>
          <p>
            <b>Hypothesis:</b> {reply.hypothesis}
          </p>
          {reply.citations.length > 0 && (
            <div className="chat-citations">
              <b>
                <BookOpen size={14} /> Evidence and references
              </b>
              {reply.citations.map((citation) => (
                <div className="chat-citation" key={citation.id}>
                  <span>
                    {citation.title} · {citation.source}:{citation.lineStart}
                    {citation.lineEnd !== citation.lineStart ? `–${citation.lineEnd}` : ''}
                  </span>
                  <small>{citation.excerpt}</small>
                </div>
              ))}
            </div>
          )}
          {reply.nextChecks.length > 0 && (
            <p>
              <b>Read-only checks:</b> {reply.nextChecks.join(' · ')}
            </p>
          )}
          {reply.notice && <small>{reply.notice}</small>}
          <div className="chat-safety">
            <ShieldCheck size={14} /> {reply.safety}
          </div>
        </div>
      )}
      {error && (
        <p className="chat-error" role="alert">
          {error}
        </p>
      )}
      <form className="chat-compose" onSubmit={submit}>
        <input
          aria-label="Ask an investigation question"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Ask what the logs show or what to check next…"
          maxLength={1200}
        />
        <button
          className="btn btn-primary"
          disabled={busy || !message.trim()}
          aria-label="Send investigation question"
        >
          {busy ? <LoaderCircle className="spin" size={16} /> : <ArrowUp size={16} />}
        </button>
      </form>
    </section>
  );
}
