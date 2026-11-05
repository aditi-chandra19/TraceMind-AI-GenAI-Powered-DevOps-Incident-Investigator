# TraceMind AI — Intelligent DevOps Incident Investigator

TraceMind is a full-stack incident investigation workspace for application and Kubernetes operations. It combines a React dashboard, an Express REST API, MongoDB persistence, streaming log ingestion, JavaScript-based retrieval, and optional OpenAI analysis. The dashboard helps an operator inspect an incident, find related events and runbooks, and export a report. AI output is advisory: **TraceMind never runs remediation or changes a production system.** A human operator must review and approve any action outside the app.

## Start here (Windows + Docker Desktop)

This is the recommended setup. It runs MongoDB in Docker and the web/API in your local Node.js terminals, so the source is easy to edit.

### 1. Install prerequisites

- Install Node.js 24 LTS (npm is included).
- Install Docker Desktop for Windows, enable its WSL 2 backend if prompted, then start Docker Desktop and wait until it says it is running.
- Open the project folder in VS Code. Open **Terminal → New Terminal** and ensure the prompt is in the repository root (the folder containing this README and `package.json`).

### 2. Create your private local configuration

Run these commands in PowerShell:

```powershell
Copy-Item .env.example .env
notepad .env
```

Set these values in `.env`:

| Variable              | What to set                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| `MONGO_ROOT_PASSWORD` | A new, long password. Letters and numbers avoid URI escaping problems.                                 |
| `MONGODB_URI`         | Use the same password: `mongodb://tracemind:YOUR_PASSWORD@127.0.0.1:27018/tracemind?authSource=admin`. |
| `JWT_SECRET`          | A unique random string, at least 32 characters.                                                        |
| `ADMIN_EMAIL`         | The email you will use to sign in.                                                                     |
| `ADMIN_PASSWORD`      | Your initial admin password, 12–72 bytes.                                                              |
| `OPENAI_API_KEY`      | Optional. Leave blank for local analysis and keyword-based runbook search.                             |

Save `.env` and close Notepad. It is ignored by Git. Never paste real credentials into `.env.example`, source files, screenshots, or GitHub commits.

### 3. Install, start the database, and seed an admin

```powershell
npm ci
npm run db:up
npm run db:seed
```

The first database start downloads the MongoDB image. `db:seed` creates your admin account and inserts four sample incidents. It is safe to run again; it will not overwrite an existing account password.

### 4. Run the website and API

```powershell
npm run dev
```

Keep this terminal open. It runs the API and Vite web server together. Open **http://localhost:5173** and sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`.

Check **http://localhost:4000/api/health**. A working MongoDB setup returns `"status":"ok"` and `"mode":"mongodb"`. The sidebar should show the database connected state. If `mode` says `demo`, check that Docker Desktop is running, run `npm run db:up`, and restart the app with **Ctrl+C**, then `npm run dev`.

To stop the app, focus its terminal and press **Ctrl+C**. To stop MongoDB while preserving its data, run `npm run db:down`. Start it again with `npm run db:up`.

## Run the production-style local containers

The containerized stack uses MongoDB, a Node API container, and an unprivileged Nginx web container. Nginx proxies the browser's `/api` requests to Express, so the browser uses one origin.

With Docker Desktop running and `.env` configured, run:

```powershell
npm run db:up
npm run db:seed
npm run stack:up
```

Open **http://localhost:8080**. The API and web containers have health checks; MongoDB has a readiness health check. Check **http://localhost:8080/api/health** for MongoDB mode. Stop the app containers with:

```powershell
npm run stack:down
```

The database volume is kept. `docker compose down -v` permanently deletes local MongoDB data; use it only when you intentionally want a clean database.

## First use: walkthrough

1. Sign in as the administrator. New self-registered accounts are analysts; admins can manage roles under **Team & access**.
2. On **Overview**, inspect active incidents, severity, health signals, and recent incident rows. Use search and filters to narrow the list. The incident row's **More actions** menu opens an investigation, copies the incident ID, or marks an open incident resolved.
3. Select **AI investigations** in the left navigation, or choose **Open investigation** on an incident. Review the incident summary and timeline. The root-cause text is an unverified hypothesis, not proof.
4. Use **Find similar** under **Related incidents**. Select a result to open that incident. Similarity is calculated from shared incident terms, service, and severity; it is a ranking aid rather than an AI claim.
5. Ask a question in **Ask about this incident**. Example: “What should I check next?” Answers can use runbook sections and uploaded lines explicitly linked to the selected incident. Review the source and line range shown under **Evidence and references**. The **Read-only checks** are suggestions. The app will not run them.
6. After an answer, choose **Helpful** or **Needs work**. An optional comment can be sent with **Send feedback**. Admins can view recorded responses in **Reports → Recent investigation feedback**.
7. Choose **Analyze logs** (or upload from the dashboard), select one `.log`, `.txt`, `.json`, `.jsonl`, or `.ndjson` file, and optionally link it to the selected incident. TraceMind streams the file, redacts secrets before storing entries, and opens the analysis report. Use **Log explorer** to revisit uploaded files and parsed source lines.
8. Use **Download PDF** or **Download Markdown** from **Reports** to export the current incident list and timelines. The report labels root-cause statements as hypotheses.
9. Change an incident status from its investigation panel. Admins can inspect security and investigation audit events through the API (see below).
10. **Settings** changes the alert threshold used by the notification list in this browser. It does not configure an external paging service.

### Roles

| Role    | Capabilities                                                                                                             |
| ------- | ------------------------------------------------------------------------------------------------------------------------ |
| Admin   | Investigate, upload/analyze logs, change incident status, manage workspace access, review feedback, and read audit logs. |
| Analyst | Investigate, upload/analyze logs, submit feedback, and update incident status.                                           |
| Viewer  | Read dashboard, incidents, log sources, and runbook retrieval; cannot chat, upload, change status, or send feedback.     |

## AI and retrieval configuration

OpenAI is optional. Add a provider key to `OPENAI_API_KEY` in `.env`, configure `OPENAI_MODEL` and `OPENAI_EMBEDDING_MODEL`, then restart the API. Model and embedding calls may incur provider charges. If the key is absent or the provider request fails, the app keeps working with local log rules, keyword-ranked runbooks, and a clearly labeled local investigation response.

Before text is sent to an external model, TraceMind applies secret and common PII redaction to incident fields, logs, user questions, conversation history, and retrieved passages. Treat redaction as a protective filter, not as a guarantee that arbitrary sensitive data can never occur in user content. Only send data you are authorized to share with the configured provider.

The current knowledge base contains three built-in operational runbooks: database pool exhaustion, Kubernetes pod restarts, and request/dependency timeouts. With MongoDB and an OpenAI key, vectors are stored on knowledge chunks and cosine-ranked in the Node service. Without the key, keyword retrieval runs locally. This small corpus uses in-process ranking rather than a managed large-scale approximate-nearest-neighbor index.

## Main dashboard controls

| Control                                           | What it does                                                                                              |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Overview / Incidents                              | Return to the dashboard or scroll to the incidents table.                                                 |
| Incident search and severity/status filters       | Narrow the current incident list; paging controls change result pages.                                    |
| Analyze logs                                      | Opens the file picker, uploads and analyzes the selected supported log file.                              |
| Log explorer                                      | Lists persisted upload sources, shows parsed numbered lines, and lets investigators re-run analysis.      |
| AI investigations                                 | Opens the selected incident context, timeline, related incidents, and conversational investigation panel. |
| Reports                                           | Opens working PDF and Markdown exports; admins also see the feedback inbox.                               |
| Team & access                                     | Admins can create/manage workspace accounts and roles.                                                    |
| Settings                                          | Saves the local browser notification severity threshold.                                                  |
| Notifications                                     | Lists incidents at or above the selected severity threshold.                                              |
| Chart date range / baseline / export              | Changes the displayed period, toggles the comparison line, and downloads chart values as CSV.             |
| Bell, profile, help, workspace, and menu controls | Open their corresponding notification, account, help, workspace, or responsive navigation panels.         |

## Upload limits and data handling

- The default upload cap is 25 MB (`MAX_UPLOAD_MB`). The parser is streaming, accepts one file per request, limits a line to 64 KiB and a source to 100,000 lines.
- JSON/JSONL and common plain text application logs are parsed for timestamps, severity, service/container/pod names, and message text. Kubernetes event fields are supported when present in JSON.
- Original uploaded bytes are not kept. Parsed messages are secret-redacted before storage; source name and line number are retained for evidence citations.
- Local demo mode keeps edits, feedback, and uploads in memory; restarting the API clears those demo changes. MongoDB mode persists incidents, accounts, sessions, audit events, feedback, sources, entries, and knowledge vectors.

## REST API

Development base URL: `http://localhost:4000/api`. Containerized base URL: `http://localhost:8080/api`. Authentication is an HttpOnly session cookie set by `POST /auth/login`. Protected routes return `401` when signed out and `403` when the role is insufficient. Request input is validated; rate-limited requests return `429`.

| Method and path                                                                 | Purpose                                                                        |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `GET /health`                                                                   | Health, storage mode, and upload limit.                                        |
| `POST /auth/login`, `POST /auth/register`, `GET /auth/me`, `POST /auth/logout`  | Authentication and session.                                                    |
| `GET /auth/users`, `POST /auth/users`                                           | Admin user and role management.                                                |
| `GET /overview`                                                                 | Dashboard summary.                                                             |
| `GET /incidents?page=1&limit=10&search=&severity=&status=`                      | Filtered, paginated incident list.                                             |
| `GET /incidents/:id`, `GET /incidents/:id/similar?limit=5`                      | Incident detail and similar incident search.                                   |
| `POST /incidents`, `PATCH /incidents/:id/status`                                | Create incident and update its status.                                         |
| `POST /logs/upload?incidentId=INC-...`                                          | Stream and parse a log file.                                                   |
| `GET /logs/sources?limit=20`, `GET /logs/sources/:id/entries?page=1&limit=100`  | Browse uploaded sources and parsed lines.                                      |
| `POST /logs/sources/:id/analyze`                                                | Produce a local or model-assisted analysis.                                    |
| `POST /investigations/search`                                                   | Search runbooks with `{ "query": "database pool exhaustion" }`.                |
| `POST /investigations/chat`                                                     | Incident investigation chat with `{ "incidentId", "message", "history": [] }`. |
| `POST /investigations/feedback`, `GET /investigations/feedback?page=1&limit=25` | Submit feedback; admins can view the feedback inbox.                           |
| `GET /audit?page=1&limit=25&action=`                                            | Admin audit event search.                                                      |

Example PowerShell call after signing in and saving cookies in `$session`:

```powershell
$body = @{ incidentId = 'INC-2847'; message = 'What should I check next?'; history = @() } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://localhost:4000/api/investigations/chat' `
  -ContentType 'application/json' -WebSession $session -Body $body
```

## Verification commands

Run these from the repository root:

```powershell
npm run format:check
npm run typecheck
npm test
npm run build
npm audit
docker compose --profile app config --quiet
```

The test suite includes API authorization/validation/integration cases, frontend interaction tests, and a small retrieval evaluation set. CI runs formatting, types, tests, build, audit, and both Docker image builds on pull requests and `main` pushes.

## Docker, Kubernetes, and AWS deployment

The API and web production images are in `apps/api/Dockerfile` and `apps/web/Dockerfile`. Local Compose runs the app containers with `npm run stack:up`. Kubernetes resources are in `k8s/`: two-replica API/web deployments, services, health probes, resource limits, an API autoscaler, and AWS ALB ingress. Kubernetes expects an externally provisioned MongoDB-compatible database such as MongoDB Atlas; the chart does not run MongoDB inside the cluster.

GitHub Actions runs CI and, on `main`, publishes API and web images to GHCR. The EKS job is disabled until the repository variable `AWS_EKS_DEPLOY_ENABLED` is set to `true`. To enable it:

1. Create an EKS cluster with worker capacity, install AWS Load Balancer Controller and Metrics Server, and create a secured MongoDB Atlas database reachable from the cluster. Restrict database access to the cluster network.
2. Create an AWS IAM OIDC provider for `https://token.actions.githubusercontent.com` with audience `sts.amazonaws.com`.
3. Create an IAM deployment role whose trust condition restricts the subject to `repo:OWNER/REPOSITORY:ref:refs/heads/main`. Grant only the required EKS cluster access and Kubernetes permissions for the `tracemind` namespace.
4. In GitHub repository **Settings → Secrets and variables → Actions**, set secret `AWS_DEPLOY_ROLE_ARN`; variables `AWS_REGION`, `EKS_CLUSTER_NAME`, and `AWS_EKS_DEPLOY_ENABLED=true`.
5. Seed the production admin once, from a trusted workstation with the production database URI and `ADMIN_EMAIL`/`ADMIN_PASSWORD` in its private `.env`:

   ```powershell
   npm ci
   npm run db:seed
   ```

6. Before the first rollout, create the namespace and application secrets from a trusted workstation. Never commit real values:

   ```powershell
   kubectl apply -f k8s/namespace.yaml
   kubectl -n tracemind create secret generic tracemind-secrets `
     --from-literal=mongodb-uri='mongodb+srv://USER:URL_ENCODED_PASSWORD@CLUSTER/tracemind?retryWrites=true&w=majority' `
     --from-literal=jwt-secret='REPLACE_WITH_A_RANDOM_SECRET_OF_AT_LEAST_32_CHARACTERS' `
     --from-literal=openai-api-key=''
   ```

7. Update `WEB_ORIGIN` in `k8s/config.yaml`, set the actual DNS name in `k8s/ingress.yaml`, and replace `REPLACE_WITH_ACM_CERTIFICATE_ARN` with a certificate ARN for that name. The ingress expects HTTPS and redirects HTTP to port 443.
8. GHCR images are private by default. Make the two packages public or create a namespace-scoped `ghcr-pull` image pull secret and add `imagePullSecrets` to both pod templates.
9. Push to `main`. CI publishes images; EKS deployment runs only if the enable variable is exactly `true`. The job applies manifests, updates deployments to the commit image tags, and waits for rollouts.

Check deployment health:

```powershell
kubectl -n tracemind get deployments,pods,services,ingress,hpa
kubectl -n tracemind rollout status deployment/tracemind-api
kubectl -n tracemind rollout status deployment/tracemind-web
kubectl -n tracemind logs deployment/tracemind-api --tail=100
```

AWS account setup, EKS/Atlas provisioning, IAM permissions, GHCR visibility, DNS, and certificates are account-specific and cannot be verified from a local development environment. The workflow and manifests are prepared; the actual cloud rollout must be enabled and checked in your AWS/GitHub accounts.

## Project layout

```text
apps/
  api/src/
    config/       Environment and upload limits
    data/         Seed incidents and built-in runbook knowledge
    middleware/   Authentication and role checks
    models/       MongoDB schemas
    routes/       Validated REST endpoints
    services/     Authentication, audit, incidents, logs, AI, retrieval
  web/src/
    components/   Dashboard, dialogs, chat, feedback, similar incidents
    features/     Sign-in and user-facing areas
    App.tsx       Dashboard composition and interaction state
    api.ts        Typed browser API client
    styles.css    Dashboard styling
.github/workflows/ CI and optional AWS deployment
k8s/             Kubernetes and AWS ALB resources
compose.yaml      Local database and optional full container stack
```

## Troubleshooting

**Port 5173 is already used:** Vite may use 5174. The API accepts local Vite fallback ports; use the URL printed by Vite.

**Health page says demo:** Start Docker Desktop, run `npm run db:up`, verify `.env` has matching Mongo credentials, then restart the API/app.

**API will not start with MongoDB required:** Check `docker compose ps`, `npm run db:logs`, and that MongoDB is reachable at `127.0.0.1:27018`. In production-like mode it is intentional for startup to fail rather than silently discard data into demo memory.

**CORS or login errors:** In development open the Vite origin (`http://localhost:5173` or the port it prints), not a `file://` page. In container mode open `http://localhost:8080` so the web proxy keeps API calls same-origin.

**No AI answer:** Local retrieval is expected when `OPENAI_API_KEY` is blank. For model-backed answers, set the key and model in `.env` and restart the API. Check provider account access and usage limits; failures fall back to local output.

**Need a fresh local database:** `docker compose down -v` deletes the database volume and all local persisted data. Back up anything you need first.
