import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { TaskLifecycle } from '../server/task-events.js';
import { createSnapshotServer, listenSnapshotServer } from '../server/snapshot-server.js';

test('isolated loopback projection: actual HTTP, no controls, no source-health mutation', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'projection-proof-'));
  const path = join(dir, 'synthetic.db');
  const db = new Database(path);
  const token = randomBytes(32).toString('hex');
  db.exec("CREATE TABLE tasks(id TEXT PRIMARY KEY,title TEXT,description TEXT,agent_id TEXT,status TEXT,created_at INTEGER); INSERT INTO tasks VALUES('pilot','Synthetic pilot','Purpose','dev','ready',1)");
  const lifecycle = new TaskLifecycle(db);
  lifecycle.link('pilot', { why: 'Synthetic projection proof', nextAction: 'Verify' });
  lifecycle.setSourceStatus('connected');
  const healthBefore = lifecycle.sourceHealth();
  const server = listenSnapshotServer(path, token, 0);
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  assert.equal(address.address, '127.0.0.1');
  const base = `http://127.0.0.1:${address.port}`;
  const headers = { authorization: `Bearer ${token}` };
  try {
    const { fetchWorkSnapshot } = await import(new URL('../../engine-mission-control-20261107/src/lib/mission-control.ts', import.meta.url).href);
    const projected = await fetchWorkSnapshot({ url: base + '/api/mission-control', token });
    assert.equal(projected.tasks[0].id, 'pilot');
    assert.equal(projected.tasks[0].state, 'queued');
    const response = await fetch(base + '/api/mission-control', { headers });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const snapshot = await response.json();
    assert.equal(snapshot.tasks[0].state, 'queued');
    assert.deepEqual(snapshot.sourceHealth, healthBefore);
    assert.equal(JSON.stringify(snapshot).includes(token), false);
    assert.deepEqual(lifecycle.sourceHealth(), healthBefore);
    for (const route of ['/api/tasks', '/api/gateway', '/api/mission-control?extra=1', '/api/mission-control/']) {
      assert.equal((await fetch(base + route, { headers })).status, 404);
    }
    for (const method of ['POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS']) {
      assert.equal((await fetch(base + '/api/mission-control', { method, headers })).status, 404);
    }
    assert.equal((await fetch(base + '/api/mission-control', { headers: { host: 'localhost', 'x-forwarded-email': 'Mildred' } })).status, 401);
    assert.equal((await fetch(base + '/api/mission-control', { headers: { authorization: 'Bearer wrong' } })).status, 401);
    // Live writes are visible, but reads must never clear or refresh source health.
    lifecycle.setSourceStatus('disconnected', 'Synthetic disconnect');
    assert.equal((await (await fetch(base + '/api/mission-control', { headers })).json()).sourceHealth.state, 'disconnected');
    db.exec('DROP TABLE task_lifecycle_events');
    const failed = await fetch(base + '/api/mission-control', { headers });
    assert.equal(failed.status, 503);
    assert.deepEqual(await failed.json(), { error: 'Work records unavailable' });
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    db.close(); rmSync(dir, { recursive: true, force: true });
  }
});

test('missing database is not created, legacy database is not migrated', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'projection-legacy-'));
  const path = join(dir, 'legacy.db');
  const token = randomBytes(32).toString('hex');
  try {
    assert.throws(() => createSnapshotServer(path, token));
    assert.equal(existsSync(path), false);
    const db = new Database(path);
    db.exec('CREATE TABLE sentinel(value TEXT)'); db.close();
    const server = listenSnapshotServer(path, token, 0);
    await once(server, 'listening');
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    assert.equal((await fetch(`http://127.0.0.1:${address.port}/api/mission-control`, { headers: { authorization: `Bearer ${token}` } })).status, 503);
    await new Promise<void>(resolve => server.close(() => resolve()));
    const check = new Database(path, { readonly: true });
    assert.deepEqual(check.prepare("SELECT name FROM sqlite_master WHERE type='table'").all(), [{ name: 'sentinel' }]);
    check.close();
    assert.throws(() => createSnapshotServer(path, 'short'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
