# Day 3: runbook retrieval and investigation chat

## What is included

- Three first-party runbooks cover database pool pressure, Kubernetes restarts, and request timeouts. `POST /api/investigations/search` retrieves matching sections and returns their Markdown file and source-line range.
- `POST /api/investigations/chat` accepts an incident ID, question, and up to eight earlier turns. It retrieves related runbook sections and uploaded log lines associated with that incident.
- When `OPENAI_API_KEY` is configured, retrieval ranks stored JavaScript embedding vectors by cosine similarity and chat uses the configured OpenAI model. MongoDB mode stores the vectors on knowledge chunks. The first query may create embeddings for the three seeded runbook sections.
- Without a key or when embedding generation fails, retrieval uses keyword overlap and chat returns a clearly labeled local, evidence-grounded response. No OpenAI calls are needed to explore the demo.
- Secret and common PII patterns are redacted from incident summaries, user chat, conversation history, retrieved text, and log text before any model request. Model citations are accepted only when they match evidence IDs supplied by the server.
- The chat is restricted to administrators and analysts, rate limited, validates request size, writes an audit event, and only recommends read-only checks. It never executes remediation.

## Enable AI locally (optional)

Copy `.env.example` to `.env`, then add your own provider key to `OPENAI_API_KEY`. `OPENAI_MODEL` selects the chat model and `OPENAI_EMBEDDING_MODEL` selects the embedding model. Restart `npm run dev` after changing `.env`. Provider usage may incur charges; local keyword retrieval and grounded fallback remain available without a key.

## Use the feature

1. Start MongoDB and the app using [the Day 2 setup](day2-setup.md), or enable demo mode.
2. Sign in as an administrator or analyst.
3. Open **AI investigations**, choose an incident, and ask a question in **Ask about this incident**.
4. Upload logs linked to that incident to add source-line log evidence to later responses. Runbook references are available immediately.

The current knowledge base is a small curated runbook set. Embedding similarity is calculated in the Node.js service and vectors are stored in MongoDB; this is suitable for the included corpus, but it is not yet a managed ANN index for a large document collection. There is no live OpenAI verification in CI because that requires a real key and incurs provider usage.

## API

### `POST /api/investigations/search`

```json
{ "query": "database connection pool exhaustion" }
```

Returns a retrieval mode and up to six matching sections with source paths and line ranges.

### `POST /api/investigations/chat`

```json
{
  "incidentId": "INC-2847",
  "message": "What should I check next?",
  "history": []
}
```

Returns a grounded response, an explicitly unverified hypothesis, validated citations, read-only next checks, and a human-approval safety statement.
