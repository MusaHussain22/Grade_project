import { randomBytes } from 'node:crypto';

const sessions = new Map();

function sweep(now) {
  for (const [id, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(id);
  }
}

export function createSession(data, ttlMs) {
  const now = Date.now();
  sweep(now);
  const id = randomBytes(32).toString('base64url');
  const session = {
    id,
    createdAt: now,
    expiresAt: now + ttlMs,
    ...data,
  };
  sessions.set(id, session);
  return session;
}

export function getSession(id) {
  if (!id) return null;
  const session = sessions.get(id);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(id);
    return null;
  }
  return session;
}

export function deleteSession(id) {
  sessions.delete(id);
}
