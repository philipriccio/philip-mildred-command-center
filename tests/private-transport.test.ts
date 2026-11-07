import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer as netServer, connect } from 'node:net';
import { createServer as httpServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { TaskLifecycle } from '../server/task-events.js';
import { listenSnapshotServer } from '../server/snapshot-server.js';

test('Engine -> Unix socket relay -> read-only projection; disconnect and reconnect are honest',async()=>{
  const {fetchWorkSnapshot}=await import(new URL('../../engine-mission-control-20261107/src/lib/mission-control.ts',import.meta.url).href);
  const dir=mkdtempSync('/tmp/work-feed-');const socketPath=join(dir,'feed.sock');
  const db=new Database(join(dir,'synthetic.db'));const token=randomBytes(32).toString('hex');
  db.exec("CREATE TABLE tasks(id TEXT PRIMARY KEY,title TEXT,description TEXT,agent_id TEXT,status TEXT,created_at INTEGER); INSERT INTO tasks VALUES('pilot','Synthetic private path','Purpose','main','ready',1)");
  const lifecycle=new TaskLifecycle(db);lifecycle.link('pilot',{why:'Synthetic private path proof',nextAction:'Review'});
  lifecycle.setSourceStatus('disconnected','Synthetic source is deliberately offline');
  const upstream=listenSnapshotServer(join(dir,'synthetic.db'),token,0);await once(upstream,'listening');
  const address=upstream.address();assert.ok(address&&typeof address!=='string');
  const relay=netServer(client=>{
    const peer=connect(address.port,'127.0.0.1');client.pipe(peer);peer.pipe(client);
    client.on('error',()=>peer.destroy());peer.on('error',()=>client.destroy());
    client.on('close',()=>peer.destroy());peer.on('close',()=>client.destroy());
  });
  relay.listen(socketPath);await once(relay,'listening');
  try {
    const options={socketPath,token};
    const projected=await fetchWorkSnapshot(options);
    assert.equal(projected.tasks[0].id,'pilot');assert.equal(projected.sourceHealth.state,'disconnected');
    await assert.rejects(fetchWorkSnapshot({...options,token:'wrong'}));
    await assert.rejects(fetchWorkSnapshot({...options,url:'https://example.test/'}),/Ambiguous/);
    await assert.rejects(fetchWorkSnapshot({...options,socketPath:'relative.sock'}),/Invalid/);
    await new Promise<void>(resolve=>relay.close(()=>resolve()));
    await assert.rejects(fetchWorkSnapshot(options));
    relay.listen(socketPath);await once(relay,'listening');
    assert.equal((await fetchWorkSnapshot(options)).sourceHealth.state,'disconnected');
  } finally {
    await new Promise<void>(resolve=>relay.close(()=>resolve()));
    await new Promise<void>(resolve=>upstream.close(()=>resolve()));
    db.close();rmSync(dir,{recursive:true,force:true});
  }
});

test('Unix transport refuses redirect, oversized, truncated, malformed and slow replies',async()=>{
  const {fetchWorkSnapshot}=await import(new URL('../../engine-mission-control-20261107/src/lib/mission-control.ts',import.meta.url).href);
  const dir=mkdtempSync('/tmp/work-failure-');const socketPath=join(dir,'feed.sock');let mode='redirect';
  const source=httpServer((_req,res)=>{
    if(mode==='redirect'){res.writeHead(302,{location:'http://example.test/'});res.end();}
    else if(mode==='oversized')res.end('x'.repeat(1_000_001));
    else if(mode==='truncated'){res.writeHead(200,{'content-length':'10000'});res.write('{');setImmediate(()=>res.destroy());}
    else if(mode==='malformed')res.end('{broken');
    // slow: intentionally no reply, test absolute request deadline
  });
  source.listen(socketPath);await once(source,'listening');
  try {
    for(mode of ['redirect','oversized','truncated','malformed','slow']) {
      await assert.rejects(fetchWorkSnapshot({socketPath,token:'synthetic-reader',timeoutMs:75}));
    }
  } finally {
    source.closeAllConnections();await new Promise<void>(resolve=>source.close(()=>resolve()));rmSync(dir,{recursive:true,force:true});
  }
});
