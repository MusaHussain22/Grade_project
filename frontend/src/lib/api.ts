import type { Gradebook, SessionResponse } from '../types';

const API_ROOT = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new ApiError('The gradebook service is unreachable.', 0);
  }

  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) {
    throw new ApiError(payload.error || `Request failed (${response.status}).`, response.status);
  }
  return payload as T;
}

export function loginRequest(body: { username: string; password: string; portalUrl: string }) {
  return request<SessionResponse>('/api/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function demoRequest() {
  return request<SessionResponse>('/api/demo', { method: 'POST' });
}

export function logoutRequest(token: string | null) {
  return request<{ ok: boolean }>('/api/logout', { method: 'POST' }, token);
}

export function gradesRequest(token: string) {
  return request<Gradebook>('/api/grades', {}, token);
}
