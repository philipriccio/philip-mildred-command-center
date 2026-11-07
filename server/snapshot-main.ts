import { listenSnapshotServer } from './snapshot-server.js';
import { createProjectionServer } from './snapshot-server.js';
import { NativeTaskSource } from './native-task-source.js';

// Deployment supervisor supplies a protected read-only token; never log it.
const path = process.env.MISSION_CONTROL_DATABASE_PATH;
const nativePath = process.env.MISSION_CONTROL_NATIVE_STATE_PATH;
const reviewLedgerPath = process.env.MISSION_CONTROL_NATIVE_REVIEW_PATH;
const ownerSession = process.env.MISSION_CONTROL_OWNER_SESSION;
const nativeSince = Number(process.env.MISSION_CONTROL_NATIVE_SINCE);
const token = process.env.COMMAND_CENTER_SNAPSHOT_TOKEN;
const port = Number(process.env.MISSION_CONTROL_SNAPSHOT_PORT ?? '3011');
if ((!path && !nativePath) || (path && nativePath) || (nativePath && !ownerSession) || (reviewLedgerPath !== undefined && !nativePath) || !token || !Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('Snapshot service configuration is incomplete');
}
const source = nativePath ? new NativeTaskSource(nativePath,ownerSession!,nativeSince,undefined,reviewLedgerPath) : null;
const server = source ? createProjectionServer(token,()=>source.snapshot()) : listenSnapshotServer(path!, token, port);
if(source){server.on('close',()=>source.close());server.listen(port,'127.0.0.1');}
server.on('listening', () => console.info('Read-only work projection listening on loopback'));
server.on('error', () => { console.error('Read-only work projection could not start'); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  });
}
