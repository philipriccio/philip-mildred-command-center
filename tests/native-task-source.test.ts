import {test} from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {mkdtempSync,rmSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {createProjectionServer} from '../server/snapshot-server.js';
import {initializeNativeTaskReviewLedger,acceptNativeTask,nativeTaskLifecycleFingerprint,type NativeReviewTask} from '../server/native-task-review.js';
import {NativeTaskSource,probeLocalGateway} from '../server/native-task-source.js';

test('native scope, lifecycle truth and payload privacy; notification delivery never means accepted work',async()=>{
 const dir=mkdtempSync('/tmp/native-task-'),path=join(dir,'synthetic.db'),db=new Database(path),now=Date.now();
 const owner='agent:main:synthetic';let ready=true,bootAt=now-10000;
 db.exec(`CREATE TABLE task_runs(task_id TEXT,runtime TEXT,owner_key TEXT,requester_agent_id TEXT,scope_kind TEXT,
 agent_id TEXT,label TEXT,status TEXT,terminal_outcome TEXT,created_at INTEGER,started_at INTEGER,ended_at INTEGER,last_event_at INTEGER,
 task TEXT,detail_json TEXT,delivery_status TEXT)`);
 const insert=db.prepare('INSERT INTO task_runs VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
 for(const [id,status,started,ended,event] of [
  ['queued','queued',null,null,now],['running','running',now-2000,null,now],['finished','succeeded',now-2000,now,now],
  ['stale','running',now-90000,null,now-80000],['missing-start','running',null,null,now],['failed','failed',now-2000,now,now],
  ['blocked','succeeded',now-2000,now,now],['other-owner','running',now-2000,null,now],['other-agent','running',now-2000,null,now]
 ])insert.run(id,'subagent',id==='other-owner'?'agent:main:another':owner,id==='other-agent'?'dev':'main','session','dev',id,status,id==='blocked'?'blocked':null,now-3000,started,ended,event,'private prompt','private detail','delivered');
 const source=new NativeTaskSource(path,owner,now-5000,async()=>({ready,checkedAt:Date.now(),bootAt}));
 try {
  const snapshot=await source.snapshot();const task=(id:string)=>snapshot.tasks.find(t=>t.id==='native:'+id)!;
  assert.equal(snapshot.tasks.length,7);assert.equal(task('queued').state,'queued');assert.equal(task('running').state,'unverified');
  for(const id of ['finished','failed','blocked'])assert.equal(task(id).state,'waiting');
  for(const id of ['stale','missing-start'])assert.equal(task(id).state,'unverified');
  assert.ok(task('blocked').obstacle?.reason.includes('blocker'));
  assert.equal(snapshot.tasks.some(t=>t.state==='delivered'),false);
  for(const privateValue of ['private prompt','private detail',owner,'delivery_status'])assert.equal(JSON.stringify(snapshot).includes(privateValue),false);
  ready=false;assert.equal((await source.snapshot()).tasks.find(t=>t.id==='native:running')!.state,'unverified');
  ready=true;bootAt=now+1;assert.equal((await source.snapshot()).tasks.find(t=>t.id==='native:running')!.state,'unverified');
  assert.equal((db.prepare('SELECT count(*) n FROM task_runs').get() as {n:number}).n,9);
 }finally{source.close();db.close();rmSync(dir,{recursive:true,force:true});}
});

// All fixtures are isolated synthetic stores; never open the installed registry.
function fixture() {
 const dir=mkdtempSync('/tmp/native-review-'),path=join(dir,'synthetic.db'),db=new Database(path),now=Date.now();
 const owner='agent:main:review-fixture';
 db.exec(`CREATE TABLE task_runs(task_id TEXT PRIMARY KEY,runtime TEXT,owner_key TEXT,requester_agent_id TEXT,scope_kind TEXT,
 agent_id TEXT,label TEXT,status TEXT,terminal_outcome TEXT,created_at INTEGER,started_at INTEGER,ended_at INTEGER,last_event_at INTEGER)`);
 const add=(id:string,patch:Record<string,unknown>={})=>{
  const row={task_id:id,runtime:'subagent',owner_key:owner,requester_agent_id:'main',scope_kind:'session',agent_id:'dev',label:id,
   status:'queued',terminal_outcome:null,created_at:now-3000,started_at:null,ended_at:null,last_event_at:now,...patch};
  db.prepare(`INSERT INTO task_runs (${Object.keys(row).join(',')}) VALUES (${Object.keys(row).map(()=>'?').join(',')})`).run(...Object.values(row));
 };
 return {path,db,now,owner,add,dispose(){db.close();rmSync(dir,{recursive:true,force:true});}};
}

test('queued tasks lose current-state assurance on stale updates, disconnect and reboot',async()=>{
 const f=fixture();let ready=true,bootAt=f.now-10000;
 f.add('fresh');f.add('old',{created_at:f.now-100000,last_event_at:f.now-90000});
 const source=new NativeTaskSource(f.path,f.owner,f.now-200000,async()=>({ready,bootAt,checkedAt:Date.now()}));
 try {
  let snapshot=await source.snapshot();
  assert.equal(snapshot.tasks.find(t=>t.id==='native:fresh')!.state,'queued');
  assert.equal(snapshot.tasks.find(t=>t.id==='native:old')!.state,'unverified');
  ready=false;snapshot=await source.snapshot();
  assert.equal(snapshot.sourceHealth.state,'disconnected');
  assert.ok(snapshot.tasks.every(t=>t.state==='unverified'&&t.obstacle));
  ready=true;bootAt=f.now+1;snapshot=await source.snapshot();
  assert.ok(snapshot.tasks.every(t=>t.state==='unverified'));
 }finally{source.close();f.dispose();}
});

test('contradictory active lifecycle metadata never claims queued or running execution',async()=>{
 const f=fixture();
 f.add('queued-started',{started_at:f.now-1000});
 f.add('queued-ended',{ended_at:f.now});
 f.add('running-ended',{status:'running',started_at:f.now-1000,ended_at:f.now});
 f.add('start-before-create',{status:'running',started_at:f.now-4000});
 f.add('event-before-start',{status:'running',started_at:f.now-1000,last_event_at:f.now-2000});
 const source=new NativeTaskSource(f.path,f.owner,f.now-5000,async()=>({ready:true,bootAt:f.now-10000,checkedAt:Date.now()}));
 try {
  assert.ok((await source.snapshot()).tasks.every(t=>t.state==='unverified'&&t.obstacle));
  f.db.prepare('UPDATE task_runs SET last_event_at=? WHERE task_id=?').run(f.now+60000,'queued-started');
  await assert.rejects(source.snapshot(),/Invalid native task timestamp/);
 }finally{source.close();f.dispose();}
});

test('scope and adoption filters precede the 200-row cap; invalid configuration fails closed',async()=>{
 const f=fixture();
 f.add('boundary',{created_at:f.now-5000});f.add('acp',{runtime:'acp'});
 f.add('pre-adoption',{created_at:f.now-5001});f.add('cli',{runtime:'cli'});f.add('cron',{runtime:'cron'});
 f.add('system',{scope_kind:'system'});f.add('requester',{requester_agent_id:'dev'});
 for(let i=0;i<205;i++)f.add('other-'+i,{owner_key:'agent:main:another',created_at:f.now});
 const source=new NativeTaskSource(f.path,f.owner,f.now-5000,async()=>({ready:true,bootAt:f.now-10000,checkedAt:Date.now()}));
 try {
  assert.deepEqual((await source.snapshot()).tasks.map(t=>t.id).sort(),['native:acp','native:boundary']);
  for(let i=0;i<205;i++)f.add('included-'+String(i).padStart(3,'0'),{created_at:f.now});
  const snapshot=await source.snapshot();assert.equal(snapshot.tasks.length,200);
  assert.equal(snapshot.tasks[0].id,'native:included-204');assert.equal(snapshot.tasks[199].id,'native:included-005');
  for(const owner of ['agent:dev:test','agent:main:','agent:main:   '])assert.throws(()=>new NativeTaskSource(f.path,owner,f.now),/scope required/);
  for(const since of [0,-1,NaN,f.now+60000])assert.throws(()=>new NativeTaskSource(f.path,f.owner,since),/adoption time required/);
 }finally{source.close();f.dispose();}
});

test('readiness probe is bounded and fails closed without network access',async(t)=>{
 let response:()=>Promise<Response>=async()=>new Response('{"ready":true,"uptimeMs":10000}');
 t.mock.method(globalThis,'fetch',async(url:unknown,options:RequestInit)=>{
  assert.equal(url,'http://127.0.0.1:18789/readyz');assert.equal(options.redirect,'error');
  assert.equal(options.cache,'no-store');assert.ok(options.signal);
  return response();
 });
 const good=await probeLocalGateway();assert.equal(good.ready,true);assert.equal(good.bootAt,good.checkedAt-10000);
 for(const body of ['{"ready":false,"uptimeMs":10000}','{"ready":true}','{"ready":true,"uptimeMs":-1}','{"ready":true,"uptimeMs":0.5}','null','not json',' '.repeat(8193)]){
  response=async()=>new Response(body);
  const health=await probeLocalGateway();assert.equal(health.ready,false);assert.equal(health.bootAt,null);
 }
 response=async()=>new Response('{}',{status:503});assert.equal((await probeLocalGateway()).ready,false);
 response=async()=>{throw Error('synthetic private network error');};assert.equal((await probeLocalGateway()).ready,false);
});

 test('notification-only updates cannot refresh queued or running execution assurance',async()=>{
 const f=fixture();
 f.add('old-queued',{created_at:f.now-120000,last_event_at:f.now});
 f.add('old-running',{status:'running',created_at:f.now-120000,started_at:f.now-90000,last_event_at:f.now});
 f.add('recent-running',{status:'running',started_at:f.now-1000,last_event_at:f.now});
 const source=new NativeTaskSource(f.path,f.owner,f.now-200000,async()=>({ready:true,bootAt:f.now-300000,checkedAt:Date.now()}));
 try{const snapshot=await source.snapshot();assert.ok(snapshot.tasks.every(t=>t.state==='unverified'));
 assert.match(snapshot.tasks.find(t=>t.id==='native:recent-running')!.obstacle!.reason,/no execution-only heartbeat/);
 assert.equal(snapshot.tasks.find(t=>t.id==='native:old-running')!.observedAt,f.now-90000);
 assert.equal(snapshot.tasks.find(t=>t.id==='native:old-queued')!.observedAt,f.now-120000);
 }finally{source.close();f.dispose();}
});


test('terminal timestamp contradictions remain unverified, including success without start',async()=>{
 const f=fixture();
 for(const [id,patch] of Object.entries({
  'no-end':{ended_at:null},'no-start':{started_at:null},
  'end-before-create':{ended_at:f.now-4000},'end-before-start':{ended_at:f.now-2500},
  'start-before-create':{started_at:f.now-4000},
 }))f.add(id,{status:'succeeded',started_at:f.now-2000,ended_at:f.now-1000,...patch});
 const source=new NativeTaskSource(f.path,f.owner,f.now-5000,async()=>({ready:true,bootAt:f.now-10000,checkedAt:Date.now()}));
 try{const snapshot=await source.snapshot();assert.equal(snapshot.tasks.length,5);
  assert.ok(snapshot.tasks.every(t=>t.state==='unverified'&&t.reviewer===null&&t.deliveredAt===null));
  assert.ok(snapshot.tasks.every(t=>t.obstacle?.reason.includes('lifecycle evidence')));
 }finally{source.close();f.dispose();}
});

test('real read-only ledger and HTTP adapter distinguish reviewed success from failure and mask changed facts',async()=>{
 const f=fixture(),ledger=join(f.path,'..','native-task-reviews.sqlite');
 initializeNativeTaskReviewLedger(ledger);
 const facts=(id:string,status:string,outcome:string|null):NativeReviewTask=>({ownerSession:f.owner,taskId:id,runtime:'subagent',agentId:'dev',status,
  terminalOutcome:outcome,createdAt:f.now-3000,startedAt:f.now-2000,endedAt:f.now-1000});
 const cases=[['success','succeeded','succeeded'],['legacy-success','succeeded',null],['failed','failed',null],['blocked','succeeded','blocked'],['unknown','succeeded','unknown'],['other-reviewer','succeeded',null],['cancelled','cancelled',null]] as const;
 for(const [id,status,outcome] of cases){
  f.add(id,{status,terminal_outcome:outcome,started_at:f.now-2000,ended_at:f.now-1000});
  const task=facts(id,status,outcome);
  acceptNativeTask(ledger,task,{lifecycleFingerprint:nativeTaskLifecycleFingerprint(task),reviewer:id==='other-reviewer'?'Dev':'Mildred',summary:'Reviewed synthetic evidence.',nextAction:'Follow the reviewed next step.',evidence:[{label:'Synthetic proof',url:'https://example.test/proof'}]});
 }
 const source=new NativeTaskSource(f.path,f.owner,f.now-5000,async()=>({ready:true,bootAt:f.now-10000,checkedAt:Date.now()}),ledger);
 const token=randomBytes(32).toString('hex'),server=createProjectionServer(token,()=>source.snapshot());
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const address=server.address();assert.ok(address&&typeof address!=='string');
 const url=`http://127.0.0.1:${address.port}/api/mission-control`;
 try{
  const {fetchWorkSnapshot}=await import(new URL('../../engine-mission-control-20261107/src/lib/mission-control.ts',import.meta.url).href);
  const projected=await fetchWorkSnapshot({url,token});
  const task=(id:string)=>projected.tasks.find((t:{id:string})=>t.id==='native:'+id)!;
  assert.equal(task('success').state,'delivered');assert.ok(task('success').deliveredAt);assert.equal(task('success').reviewer,'Mildred');
  assert.equal(task('success').history.at(-1).kind,'delivered');assert.equal(task('legacy-success').state,'delivered');
  for(const id of ['failed','blocked','unknown','cancelled']){
   assert.equal(task(id).state,'waiting');assert.equal(task(id).deliveredAt,null);assert.equal(task(id).reviewer,'Mildred');
   assert.equal(task(id).history.at(-1).kind,'outcome_reviewed');assert.equal(task(id).evidence.length,1);
   assert.equal(task(id).nextAction,'Follow the reviewed next step.');
  }
  assert.match(task('failed').progress,/run failed/);assert.match(task('blocked').progress,/reported a blocker/);
  assert.equal(task('other-reviewer').state,'waiting');assert.equal(task('other-reviewer').reviewer,null);
  // Notification timestamps do not revoke acceptance; lifecycle changes do.
  f.db.prepare("UPDATE task_runs SET last_event_at=? WHERE task_id='success'").run(Date.now());
  assert.equal((await source.snapshot()).tasks.find(t=>t.id==='native:success')!.state,'delivered');
  f.db.prepare("UPDATE task_runs SET ended_at=ended_at+1 WHERE task_id='success'").run();
  const changed=(await source.snapshot()).tasks.find(t=>t.id==='native:success')!;
  assert.equal(changed.state,'waiting');assert.equal(changed.reviewer,null);assert.equal(changed.evidence.length,0);
  assert.equal((await fetch(url,{method:'POST',headers:{authorization:`Bearer ${token}`}})).status,404);
  // Simulated disk/schema failure must be unavailable, never connected with missing reviews.
  const writer=new Database(ledger);writer.exec('DROP TABLE native_task_acceptances');writer.close();
  const unavailable=await fetch(url,{headers:{authorization:`Bearer ${token}`}});
  assert.equal(unavailable.status,503);assert.deepEqual(await unavailable.json(),{error:'Work records unavailable'});
  await assert.rejects(fetchWorkSnapshot({url,token}),/unavailable/);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));source.close();f.dispose();}
});

test('configured missing ledger fails closed without creating any file',()=>{
 const f=fixture(),ledger=join(f.path,'..','native-task-reviews.sqlite');
 try{
  assert.throws(()=>new NativeTaskSource(f.path,f.owner,f.now-5000,undefined,ledger));
  assert.equal(existsSync(ledger),false);
  assert.equal((f.db.prepare('SELECT count(*) n FROM task_runs').get() as {n:number}).n,0);
 }finally{f.dispose();}
});
