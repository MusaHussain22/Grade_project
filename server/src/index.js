import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { fetchGradeHtml, loginToPortal } from './hacClient.js';
import { parseGrades } from './parseGrades.js';
import { PortalError } from './portal.js';
import { createSession, deleteSession, getSession } from './sessionStore.js';

const FIXTURE_URL = new URL('../fixtures/assignments.html', import.meta.url);
const demoHtml = readFileSync(FIXTURE_URL, 'utf8');
const ttlMs = Number(process.env.SESSION_TTL_HOURS || 8) * 60 * 60 * 1000;
const attempts = new Map();

function clientAddress(req) {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function allowAttempt(key, limit, windowMs) {
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= limit) {
    attempts.set(key, recent);
    return false;
  }
  recent.push(now);
  attempts.set(key, recent);
  return true;
}

function readToken(req) {
  const header = req.get('authorization') || '';
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  return req.cookies?.hac_session || null;
}

function sendSession(res, session) {
  res.cookie('hac_session', session.id, {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: Math.max(session.expiresAt - Date.now(), 0),
    path: '/',
  });
  res.json({
    token: session.id,
    studentName: session.studentName,
    demo: session.kind === 'demo',
  });
}

function createDemoSession() {
  return createSession({
    kind: 'demo',
    studentName: 'Alex Rivera',
    username: 'demo',
  }, ttlMs);
}

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  const configured = (process.env.CLIENT_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const devOrigins = process.env.NODE_ENV === 'production'
    ? []
    : ['http://localhost:5173', 'http://127.0.0.1:5173'];
  const allowedOrigins = [...new Set([...devOrigins, ...configured])];

  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(null, false);
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - started}ms`);
    });
    next();
  });

  app.get('/api/health', (req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/demo', (req, res) => {
    if (!allowAttempt(`demo:${clientAddress(req)}`, 30, 15 * 60 * 1000)) {
      res.status(429).json({ error: 'Too many preview requests. Wait a few minutes and try again.' });
      return;
    }
    sendSession(res, createDemoSession());
  });

  app.post('/api/login', asyncRoute(async (req, res) => {
    if (!allowAttempt(`login:${clientAddress(req)}`, 10, 15 * 60 * 1000)) {
      res.status(429).json({ error: 'Too many sign-in attempts. Wait a few minutes and try again.' });
      return;
    }

    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    const portalUrl = String(req.body?.portalUrl || '');
    if (!username || !password) {
      throw new PortalError('Enter both a username and a password.');
    }
    if (username.length > 100 || password.length > 200 || portalUrl.length > 500) {
      throw new PortalError('Those sign-in fields are too long.');
    }

    if (username === 'demo' && password === 'demo') {
      sendSession(res, createDemoSession());
      return;
    }

    const signedIn = await loginToPortal({ portalUrl, username, password });
    const session = createSession({
      kind: 'hac',
      jar: signedIn.jar,
      portal: signedIn.portal,
      username,
      studentName: signedIn.studentName,
    }, ttlMs);
    sendSession(res, session);
  }));

  app.post('/api/logout', (req, res) => {
    deleteSession(readToken(req));
    res.clearCookie('hac_session', { path: '/' });
    res.json({ ok: true });
  });

  app.get('/api/grades', asyncRoute(async (req, res) => {
    const session = getSession(readToken(req));
    if (!session) {
      throw new PortalError('The portal session expired. Sign in again.', 401);
    }
    if (session.kind === 'demo') {
      res.json(parseGrades(demoHtml, {
        studentName: 'Alex Rivera',
        source: 'demo',
      }));
      return;
    }

    const html = await fetchGradeHtml(session);
    const gradebook = parseGrades(html, {
      studentName: session.studentName,
      source: 'hac',
    });
    if (gradebook.studentName && gradebook.studentName !== 'Student') {
      session.studentName = gradebook.studentName;
    }
    res.json(gradebook);
  }));

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    const status = error.status || 500;
    const message = status >= 500 && !error.status
      ? 'The gradebook service hit an unexpected error.'
      : error.message;
    res.status(status).json({ error: message || 'Request failed.' });
  });

  return app;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const port = Number(process.env.PORT || 8787);
  createApp().listen(port, () => {
    console.log(`Gradebook API listening on ${port}`);
  });
}
