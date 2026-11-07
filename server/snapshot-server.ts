import { createServer, type Server } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import Database from 'better-sqlite3';
import { readTaskSnapshot } from './task-events.js';

/** Dedicated projection listener. Never imports the legacy application, gateway,
 * migration constructor, task controls, or external-service integrations.
 * A separately approved private transport may terminate at its loopback port.
 */
export function createSnapshotServer(databasePath: string, readToken: string): Server {
  if (Buffer.byteLength(readToken) < 32 || /[\s\x00-\x1f\x7f]/.test(readToken)) {
    throw new Error('A dedicated protected read credential is required');
  }
  const db = new Database(databasePath, { readonly: true, fileMustExist: true });
  db.pragma('query_only = ON');
  db.pragma('busy_timeout = 1000');
  const expected = Buffer.from(`Bearer ${readToken}`);
  const server = createServer({ maxHeaderSize: 8192 }, (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const reply = (status: number, body: string) => { res.writeHead(status); res.end(body); };
    const supplied = Buffer.from(req.headers.authorization ?? '');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      reply(401, '{"error":"Unauthorized"}'); return;
    }
    if (req.method !== 'GET' || req.url !== '/api/mission-control') {
      reply(404, '{"error":"Not found"}'); return;
    }
    if (req.headers['transfer-encoding'] || (req.headers['content-length'] && req.headers['content-length'] !== '0')) {
      res.setHeader('Connection', 'close'); reply(400, '{"error":"Request body not permitted"}'); return;
    }
    try {
      const body = JSON.stringify(readTaskSnapshot(db));
      if (Buffer.byteLength(body) > 1_000_000) throw new Error('Projection too large');
      reply(200, body);
    } catch {
      reply(503, '{"error":"Work records unavailable"}');
    }
  });
  server.headersTimeout = 5000;
  server.requestTimeout = 5000;
  server.keepAliveTimeout = 1000;
  server.maxConnections = 16;
  server.on('close', () => db.close());
  return server;
}

export function listenSnapshotServer(databasePath: string, readToken: string, port: number): Server {
  const server = createSnapshotServer(databasePath, readToken);
  server.listen(port, '127.0.0.1');
  return server;
}
