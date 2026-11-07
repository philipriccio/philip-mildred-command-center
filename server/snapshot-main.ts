import { listenSnapshotServer } from './snapshot-server.js';

// Deployment supervisor supplies a protected read-only token; never log it.
const path = process.env.MISSION_CONTROL_DATABASE_PATH;
const token = process.env.COMMAND_CENTER_SNAPSHOT_TOKEN;
const port = Number(process.env.MISSION_CONTROL_SNAPSHOT_PORT ?? '3011');
if (!path || !token || !Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('Snapshot service configuration is incomplete');
}
const server = listenSnapshotServer(path, token, port);
server.on('listening', () => console.info('Read-only work projection listening on loopback'));
server.on('error', () => { console.error('Read-only work projection could not start'); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  });
}
