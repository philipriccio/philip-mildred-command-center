#!/usr/bin/env node
import { WebSocket } from 'ws';

const baseUrl = process.env.COMMAND_CENTER_SMOKE_URL ?? 'http://127.0.0.1:3999';
const token = process.env.COMMAND_CENTER_SMOKE_TOKEN;
const proxyEmail = process.env.COMMAND_CENTER_SMOKE_EMAIL;

if (!token && !proxyEmail) {
  console.error('Set COMMAND_CENTER_SMOKE_TOKEN or COMMAND_CENTER_SMOKE_EMAIL.');
  process.exit(2);
}

function wsUrlFor(url) {
  const parsed = new URL(url);
  parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
  parsed.pathname = '/ws';
  parsed.search = '';
  return parsed.toString();
}

async function request(path, { auth = false, method = 'GET', body } = {}) {
  const headers = {};
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  if (auth && proxyEmail) headers['cf-access-authenticated-user-email'] = proxyEmail;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(new URL(path, baseUrl), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, text: await res.text() };
}

function expectStatus(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
  console.log(`OK ${label}: ${actual}`);
}

function connectWs({ auth = false } = {}) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (auth && token) headers.Authorization = `Bearer ${token}`;
    if (auth && proxyEmail) headers['cf-access-authenticated-user-email'] = proxyEmail;
    const ws = new WebSocket(wsUrlFor(baseUrl), { headers });
    const timeout = setTimeout(() => {
      ws.terminate();
      reject(new Error(`WebSocket ${auth ? 'auth' : 'unauth'} timed out`));
    }, 5000);
    ws.on('open', () => {
      if (!auth) return;
      clearTimeout(timeout);
      ws.close();
      resolve({ opened: true });
    });
    ws.on('close', (code) => {
      if (auth) return;
      clearTimeout(timeout);
      resolve({ opened: false, code });
    });
    ws.on('error', (err) => {
      if (auth) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  });
}

const unauthHealth = await request('/api/health');
expectStatus('unauth /api/health', unauthHealth.status, 401);

const authHealth = await request('/api/health', { auth: true });
expectStatus('auth /api/health', authHealth.status, 200);

const highRiskSend = await request('/api/gateway/send', {
  auth: true,
  method: 'POST',
  body: { agentId: 'main', message: 'smoke' },
});
expectStatus('auth high-risk /api/gateway/send', highRiskSend.status, 403);

const highRiskCron = await request('/api/cron/run/smoke-job', { auth: true, method: 'POST' });
expectStatus('auth high-risk /api/cron/run/:jobId', highRiskCron.status, 403);

const highRiskToken = await request('/api/selftape/diagnostics/access-token', { auth: true });
expectStatus('auth high-risk diagnostics token', highRiskToken.status, 403);

const unauthWs = await connectWs({ auth: false });
if (unauthWs.opened || unauthWs.code !== 1008) {
  throw new Error(`unauth /ws expected close 1008, got ${JSON.stringify(unauthWs)}`);
}
console.log('OK unauth /ws rejected: 1008');

await connectWs({ auth: true });
console.log('OK auth /ws opened');

console.log('Mission Control public-boundary smoke passed.');
