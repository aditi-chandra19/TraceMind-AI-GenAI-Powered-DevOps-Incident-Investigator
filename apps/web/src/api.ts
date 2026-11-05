import type { Incident } from './types';
import { demoIncidents } from './data/demo';

const base = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'analyst' | 'viewer';
}
export interface Session {
  user: SessionUser;
  mode: 'mongodb' | 'demo';
}
export interface ApiError extends Error {
  status: number;
}
export interface LogSource {
  _id?: string;
  id?: string;
  originalName: string;
  sizeBytes: number;
  lineCount: number;
  incidentId?: string;
  redacted: boolean;
  format: string;
  createdAt: string;
}
export interface LogEntry {
  _id?: string;
  id?: string;
  lineNumber: number;
  timestamp?: string;
  level?: string;
  service?: string;
  message: string;
}
export interface WorkspaceMember {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  role: SessionUser['role'];
  disabled?: boolean;
  createdAt?: string;
}
export interface LogAnalysis {
  source: {
    id: string;
    name: string;
    totalLines: number;
    analyzedLines: number;
    truncated: boolean;
  };
  analysisMode: 'openai' | 'local-rules' | 'local-fallback';
  providerNotice?: string;
  summary: string;
  severity: Incident['severity'];
  confidence: number;
  rootCauseHypothesis: string;
  errorClusters: { signature: string; count: number; lineNumbers: number[] }[];
  stackTraceLineNumbers: number[];
  anomalies: { description: string; lineNumbers: number[] }[];
  evidence: LogEntry[];
  recommendations: string[];
}
export interface InvestigationReply {
  incidentId: string;
  mode: 'openai' | 'local-rules' | 'local-fallback';
  retrievalMode: 'semantic' | 'keyword';
  answer: string;
  hypothesis: string;
  citations: {
    id: string;
    title: string;
    source: string;
    lineStart: number;
    lineEnd: number;
    excerpt: string;
  }[];
  nextChecks: string[];
  notice?: string;
  safety: string;
}
export interface InvestigationTurn {
  role: 'user' | 'assistant';
  content: string;
}
export interface SimilarIncident {
  incident: Incident;
  similarityScore: number;
  reasons: string[];
}
export interface InvestigationFeedbackEntry {
  incidentId: string;
  actorEmail: string;
  rating: 'helpful' | 'not-helpful';
  comment: string;
  createdAt: string;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has('content-type'))
    headers.set('content-type', 'application/json');
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers,
    credentials: 'include',
    signal: init.signal ?? AbortSignal.timeout(8000),
  });
  const body = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = new Error(body?.error ?? `Request failed (${response.status})`) as ApiError;
    error.status = response.status;
    throw error;
  }
  return body as T;
}

export async function getCurrentUser(): Promise<Session | null> {
  try {
    const result = await request<{ data: SessionUser; mode: Session['mode'] }>('/auth/me');
    return { user: result.data, mode: result.mode };
  } catch (error) {
    if ((error as ApiError).status === 401) return null;
    throw error;
  }
}

export async function getRuntimeMode(): Promise<Session['mode']> {
  const result = await request<{ mode: Session['mode'] }>('/health');
  return result.mode;
}

export async function signIn(email: string, password: string): Promise<Session> {
  const result = await request<{ data: { user: SessionUser }; mode: Session['mode'] }>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
  );
  return { user: result.data.user, mode: result.mode };
}

export async function signUp(name: string, email: string, password: string): Promise<Session> {
  const result = await request<{ data: { user: SessionUser }; mode: Session['mode'] }>(
    '/auth/register',
    { method: 'POST', body: JSON.stringify({ name, email, password }) },
  );
  return { user: result.data.user, mode: result.mode };
}

export async function signOut() {
  await request<void>('/auth/logout', { method: 'POST' });
}

export async function getIncidents(): Promise<{ data: Incident[]; mode: 'mongodb' | 'demo' }> {
  try {
    const result = await request<{ data: Incident[]; mode: 'mongodb' | 'demo' }>(
      '/incidents?limit=100',
    );
    return result;
  } catch (error) {
    if ((error as ApiError).status === 401) throw error;
    return { data: demoIncidents, mode: 'demo' };
  }
}

export async function uploadLog(file: File, incidentId?: string) {
  const form = new FormData();
  form.append('file', file, file.name);
  const suffix = incidentId ? `?incidentId=${encodeURIComponent(incidentId)}` : '';
  return request<{
    data: {
      source: { id: string; originalName: string; lineCount: number; redacted: true };
      stored: number;
    };
    mode: 'mongodb' | 'demo';
  }>(`/logs/upload${suffix}`, { method: 'POST', body: form });
}

export async function getLogSources(): Promise<LogSource[]> {
  const result = await request<{ data: LogSource[] }>('/logs/sources?limit=50');
  return result.data;
}

export async function getLogEntries(sourceId: string): Promise<LogEntry[]> {
  const result = await request<{ data: LogEntry[] }>(
    `/logs/sources/${encodeURIComponent(sourceId)}/entries?limit=100`,
  );
  return result.data;
}

export async function analyzeLogSource(sourceId: string): Promise<LogAnalysis> {
  const result = await request<{ data: LogAnalysis }>(
    `/logs/sources/${encodeURIComponent(sourceId)}/analyze`,
    { method: 'POST' },
  );
  return result.data;
}

export async function getWorkspaceMembers(): Promise<WorkspaceMember[]> {
  const result = await request<{ data: WorkspaceMember[] }>('/auth/users');
  return result.data;
}

export async function updateIncidentStatus(
  incidentId: string,
  status: Incident['status'],
): Promise<Incident> {
  const result = await request<{ data: Incident }>(
    `/incidents/${encodeURIComponent(incidentId)}/status`,
    { method: 'PATCH', body: JSON.stringify({ status }) },
  );
  return result.data;
}

export async function sendInvestigationMessage(
  incidentId: string,
  message: string,
  history: InvestigationTurn[],
) {
  const result = await request<{ data: InvestigationReply }>('/investigations/chat', {
    method: 'POST',
    body: JSON.stringify({ incidentId, message, history }),
  });
  return result.data;
}

export async function getSimilarIncidents(incidentId: string): Promise<SimilarIncident[]> {
  const result = await request<{ data: SimilarIncident[] }>(
    `/incidents/${encodeURIComponent(incidentId)}/similar?limit=5`,
  );
  return result.data;
}

export async function submitInvestigationFeedback(input: {
  incidentId: string;
  rating: 'helpful' | 'not-helpful';
  comment: string;
}) {
  const result = await request<{ data: { accepted: true; rating: 'helpful' | 'not-helpful' } }>(
    '/investigations/feedback',
    { method: 'POST', body: JSON.stringify(input) },
  );
  return result.data;
}

export async function getInvestigationFeedback(): Promise<InvestigationFeedbackEntry[]> {
  const result = await request<{ data: InvestigationFeedbackEntry[] }>(
    '/investigations/feedback?limit=20',
  );
  return result.data;
}
