# TraceMind AI

TraceMind AI is an incident-investigation workspace built with React, Express, MongoDB, and optional OpenAI reasoning. It stores incidents, parses uploaded application logs, redacts sensitive values, retrieves runbooks, and keeps AI suggestions advisory. The application never executes production remediation.

## Start locally on Windows

### Recommended: app with MongoDB in Docker

1. Install Node.js 24 LTS and Docker Desktop, then start Docker Desktop.
2. In PowerShell at the repository root, create the local environment file:

   ```powershell
   Copy-Item .env.example .env
   notepad .env
   ```

   Set unique values for `MONGO_ROOT_PASSWORD`, `JWT_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`. Use a URI-safe Mongo password (letters and digits) or URL-encode special characters in `MONGODB_URI`. Keep `.env` private; it is ignored by Git.

3. Install packages, start MongoDB, seed the administrator and sample incidents, then start both development servers:

   ```powershell
   npm ci
   npm run db:up
   npm run db:seed
   npm run dev
   ```

4. Open [http://localhost:5173](http://localhost:5173), sign in with the admin values from `.env`, and check [http://localhost:4000/api/health](http://localhost:4000/api/health). The API should report `"mode":"mongodb"`.

Keep the terminal running. Stop the app with **Ctrl+C**. MongoDB can be stopped separately with `npm run db:down`; this keeps its Docker volume. `npm run db:up` starts it again.

### Run the whole stack in containers

With `.env` configured as above and Docker Desktop running:

```powershell
npm run db:up
npm run db:seed
npm run stack:up
```

Open [http://localhost:8080](http://localhost:8080). The web container proxies `/api` requests to Express and the API connects to the Mongo service on the Compose network. Stop the app containers with `npm run stack:down`. MongoDB data remains in the named `tracemind-mongo-data` volume.

### Optional OpenAI support

Add an API key to `OPENAI_API_KEY` in `.env` and restart the API. Set `OPENAI_MODEL` and `OPENAI_EMBEDDING_MODEL` as needed. Without a key, chat and runbook retrieval use local keyword matching and report generation uses local rules. A real provider key is never committed or required to try the app.

## Main features

- Secure login, analyst/viewer roles, server-side sessions, audit records, and persisted MongoDB incidents.
- Incident filtering, timeline, log uploads, parsed source lines, secret redaction, error clustering, and anomaly indicators.
- Incident-context investigation chat with local or OpenAI-backed retrieval and validated runbook/log citations.
- Markdown incident reports, status changes with audit events, and configurable browser-side alert thresholds.
- Human review required for remediation; no automated production actions.

See [Day 2 setup](docs/day2-setup.md) and [Day 3 investigation chat](docs/day3-investigation-chat.md) for operational details.

## Project checks

```powershell
npm run format:check
npm run typecheck
npm test
npm run build
npm audit
```

The GitHub Actions workflow runs these checks on pull requests and pushes to `main`, and also verifies both Docker builds.

## Containers and AWS

- API and web Dockerfiles: `apps/api/Dockerfile`, `apps/web/Dockerfile`.
- Local Compose stack: `compose.yaml` (`npm run stack:up`).
- Kubernetes resources: `k8s/`.
- CI and GHCR/EKS workflow: `.github/workflows/`.
- AWS setup and required GitHub configuration: [AWS EKS deployment](docs/aws-eks-deployment.md).
- Component boundaries: [architecture](docs/architecture.md).

The AWS workflow publishes images to GHCR when `main` changes. It deploys to EKS only after the AWS OIDC role and repository variables are configured. Cloud provisioning and deployment credentials are intentionally not included in this repository.
