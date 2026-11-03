# TraceMind AI — Intelligent DevOps Incident Investigator

TraceMind turns operational signals into an evidence-backed incident investigation workspace. This repository is a JavaScript/TypeScript monorepo: React + Tailwind frontend and a Node.js + Express API, with MongoDB and LLM integrations designed to be optional in demo mode.

## Day 1 — Foundation

Day 1 establishes the responsive incident dashboard, typed API boundary, demo incident dataset, API health and incident endpoints, and local development workflow. The dashboard works immediately with realistic seeded demo data; it also reads from the API when available. Authentication, Mongo-backed persistence, streaming ingestion, AI/RAG, reports, and deployment automation are scheduled for the remaining build days.

## Requirements

- Node.js 20.19+ or 22.12+ (Node 24 also works)
- npm 10+
- MongoDB is optional for Day 1 demo mode

## Windows setup

1. Install Node.js LTS and Git.
2. In PowerShell, open this folder and run `Copy-Item .env.example .env`.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open `http://localhost:5173`. The API health endpoint is `http://localhost:4000/api/health`.

To start with MongoDB locally, install MongoDB Community Server or run `docker compose up -d mongo` once the compose setup lands, then set `MONGODB_URI` in `.env`.

## Repository layout

```text
apps/
  api/       Express API, domain services, validation and tests
  web/       React dashboard, reusable UI and API client
```

## Safety principles

TraceMind analyzes evidence and recommends actions. It must never execute remediation or change a production system. AI findings must distinguish source-backed observations from hypotheses, quote exact log line references when available, redact sensitive values before external calls, and state uncertainty.

## Planned four-day delivery

- **Day 1:** Monorepo foundation, API, demo incident data, responsive dashboard.
- **Day 2:** Authentication and roles, Mongo persistence, log upload/parsing and secure ingestion.
- **Day 3:** AI investigation, retrieval and citations, chat, similar incidents and reports.
- **Day 4:** Tests/evaluations, operational hardening, Docker/Kubernetes/AWS docs, GitHub Actions and end-to-end verification.

See `.env.example` for configuration names; never commit real credentials.
