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
