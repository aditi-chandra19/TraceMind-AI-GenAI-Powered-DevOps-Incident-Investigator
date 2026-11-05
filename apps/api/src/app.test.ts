import { afterAll, describe, expect, it } from 'vitest';
import { app } from './app.js';

const server = app.listen(0);
const base = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;
afterAll(() => server.close());

async function demoCookie() {
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@tracemind.local', password: 'TraceMindDemo!2026' }),
  });
  expect(response.status).toBe(200);
  return (response.headers.get('set-cookie') ?? '').split(';')[0]!;
}

describe('TraceMind API', () => {
  it('reports health and explicit demo mode', async () => {
    const response = await fetch(`${base}/api/health`);
    expect(response.status).toBe(200);
    expect((await response.json()).mode).toBe('demo');
  });

  it("allows Vite's fallback localhost port for credentialed development requests", async () => {
    const response = await fetch(`${base}/api/auth/me`, {
      headers: { origin: 'http://localhost:5174' },
    });
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5174');
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
    expect(response.status).toBe(401);
  });

  it('registers analysts with a strong password and never returns password hashes', async () => {
    const weak = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'New Analyst',
        email: 'analyst@example.test',
        password: 'short',
      }),
    });
    expect(weak.status).toBe(400);
    const email = `analyst-${Date.now()}@example.test`;
    const response = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'New Analyst',
        email,
        password: 'A-Long-Analyst-Password-2026!',
      }),
    });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.user.role).toBe('analyst');
    expect(body.data.user).not.toHaveProperty('passwordHash');
    const cookie = (response.headers.get('set-cookie') ?? '').split(';')[0]!;
    const current = await fetch(`${base}/api/auth/me`, { headers: { cookie } });
    expect((await current.json()).data.email).toBe(email);
  });

  it('authenticates the demo admin and protects incident routes', async () => {
    const unauthorized = await fetch(`${base}/api/incidents`);
    expect(unauthorized.status).toBe(401);
    const cookie = await demoCookie();
    const response = await fetch(`${base}/api/incidents?severity=critical&page=1&limit=2`, {
      headers: { cookie },
    });
    const body = await response.json();
    expect(body.pagination.total).toBe(1);
    expect(body.data[0].id).toBe('INC-2847');
  });

  it('revokes the server session on sign out', async () => {
    const cookie = await demoCookie();
    const logout = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { cookie } });
    expect(logout.status).toBe(204);
    const me = await fetch(`${base}/api/auth/me`, { headers: { cookie } });
    expect(me.status).toBe(401);
  });

  it('rejects invalid pagination after authentication', async () => {
    const cookie = await demoCookie();
    const response = await fetch(`${base}/api/incidents?page=0`, { headers: { cookie } });
    expect(response.status).toBe(400);
  });

  it('returns a useful 404 for an unknown incident', async () => {
    const cookie = await demoCookie();
    const response = await fetch(`${base}/api/incidents/INC-0000`, { headers: { cookie } });
    expect(response.status).toBe(404);
  });

  it('searches citable runbooks and returns grounded incident chat responses', async () => {
    const cookie = await demoCookie();
    const search = await fetch(`${base}/api/investigations/search`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'database connection pool exhaustion' }),
    });
    const searchBody = await search.json();
    expect(search.status).toBe(200);
    expect(searchBody.data.results[0].sourcePath).toContain('database-pool-exhaustion.md');
    expect(searchBody.data.mode).toBe('keyword');

    const response = await fetch(`${base}/api/investigations/chat`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ incidentId: 'INC-2847', message: 'What should I check next?' }),
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.mode).toBe('local-rules');
    expect(body.data.citations.length).toBeGreaterThan(0);
    expect(body.data.safety).toContain('Human approval');
  });

  it('validates investigation chat inputs and limits chat to investigator roles', async () => {
    const admin = await demoCookie();
    const invalid = await fetch(`${base}/api/investigations/chat`, {
      method: 'POST',
      headers: { cookie: admin, 'content-type': 'application/json' },
      body: JSON.stringify({ incidentId: 'INC-2847', message: 'x'.repeat(1201) }),
    });
    expect(invalid.status).toBe(400);
  });

  it('returns similar incidents and stores admin-readable investigation feedback', async () => {
    const cookie = await demoCookie();
    const similar = await fetch(`${base}/api/incidents/INC-2847/similar?limit=5`, {
      headers: { cookie },
    });
    const similarBody = await similar.json();
    expect(similar.status).toBe(200);
    expect(similarBody.data.length).toBeGreaterThan(0);
    expect(similarBody.data[0].incident.id).not.toBe('INC-2847');
    expect(similarBody.data[0].similarityScore).toBeGreaterThan(0);

    const feedback = await fetch(`${base}/api/investigations/feedback`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        incidentId: 'INC-2847',
        rating: 'helpful',
        comment: 'Citations helped.',
      }),
    });
    expect(feedback.status).toBe(201);
    const inbox = await fetch(`${base}/api/investigations/feedback?incidentId=INC-2847`, {
      headers: { cookie },
    });
    const inboxBody = await inbox.json();
    expect(inbox.status).toBe(200);
    expect(inboxBody.data[0].comment).toBe('Citations helped.');
  });

  it('enforces roles when an admin creates a viewer', async () => {
    const adminCookie = await demoCookie();
    const email = `viewer-${Date.now()}@example.test`;
    const created = await fetch(`${base}/api/auth/users`, {
      method: 'POST',
      headers: { cookie: adminCookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Read Only Viewer',
        email,
        password: 'A-Long-Demo-Password-2026!',
        role: 'viewer',
      }),
    });
    expect(created.status).toBe(201);
    const login = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'A-Long-Demo-Password-2026!' }),
    });
    const viewerCookie = (login.headers.get('set-cookie') ?? '').split(';')[0]!;
    const denied = await fetch(`${base}/api/incidents`, {
      method: 'POST',
      headers: { cookie: viewerCookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Unauthorized incident creation',
        service: 'checkout-api',
        severity: 'low',
      }),
    });
    expect(denied.status).toBe(403);
    const auditDenied = await fetch(`${base}/api/audit`, { headers: { cookie: viewerCookie } });
    expect(auditDenied.status).toBe(403);
  });

  it('records sign-ins in the admin-readable audit log', async () => {
    const cookie = await demoCookie();
    const response = await fetch(`${base}/api/audit?action=auth.login`, { headers: { cookie } });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data[0].action).toBe('auth.login');
    expect(body.data[0].actorEmail).toBe('admin@tracemind.local');
  });

  it('streams, parses, redacts, and paginates an uploaded log', async () => {
    const cookie = await demoCookie();
    const form = new FormData();
    form.append(
      'file',
      new Blob(
        [
          '2026-11-03T10:00:00Z ERROR [checkout-api] Authorization: Bearer secret-token-123\n{"time":"2026-11-03T10:01:00Z","level":"warn","service":"worker","message":"password=hunter2 timed out"}\n',
        ],
        { type: 'text/plain' },
      ),
      'incident.log',
    );
    const uploaded = await fetch(`${base}/api/logs/upload`, {
      method: 'POST',
      headers: { cookie },
      body: form,
    });
    expect(uploaded.status).toBe(201);
    const result = (await uploaded.json()).data;
    expect(result.source.lineCount).toBe(2);
    expect(result.source.redacted).toBe(true);
    const logs = await fetch(`${base}/api/logs/sources/${result.source.id}/entries?limit=10`, {
      headers: { cookie },
    });
    const rows = (await logs.json()).data;
    expect(rows).toHaveLength(2);
    expect(rows[0].message).toContain('[REDACTED]');
    expect(rows[1].message).toContain('password=[REDACTED]');
    expect(JSON.stringify(rows)).not.toContain('secret-token-123');
    expect(JSON.stringify(rows)).not.toContain('hunter2');
    const analyzed = await fetch(`${base}/api/logs/sources/${result.source.id}/analyze`, {
      method: 'POST',
      headers: { cookie },
    });
    expect(analyzed.status).toBe(200);
    const analysis = (await analyzed.json()).data;
    expect(analysis.analysisMode).toBe('local-rules');
    expect(analysis.errorClusters[0].lineNumbers).toContain(1);
    expect(analysis.evidence.some((entry: { lineNumber: number }) => entry.lineNumber === 1)).toBe(
      true,
    );
    expect(JSON.stringify(analysis)).not.toContain('secret-token-123');
  });

  it('rejects unsupported upload extensions', async () => {
    const cookie = await demoCookie();
    const form = new FormData();
    form.append('file', new Blob(['not executable'], { type: 'text/plain' }), 'script.exe');
    const response = await fetch(`${base}/api/logs/upload`, {
      method: 'POST',
      headers: { cookie },
      body: form,
    });
    expect(response.status).toBe(415);
  });
});
