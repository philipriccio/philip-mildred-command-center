import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TaskLifecycle, type LifecycleEvent } from '../server/task-events.js';

test('durable lifecycle, adversarial transitions, transaction rollback and restart replay',()=>{
 const dir=mkdtempSync(join(tmpdir(),'mission-lifecycle-'));const path=join(dir,'synthetic.db');let db=new Database(path);
 try {
 db.pragma('foreign_keys=ON');db.exec(`CREATE TABLE tasks(id TEXT PRIMARY KEY,title TEXT,description TEXT,agent_id TEXT,status TEXT,created_at INTEGER);
 INSERT INTO tasks VALUES('pilot','Synthetic pilot','Purpose','dev','ready',1),('legacy','Old report','Purpose','main','complete',2),('recurring','Next occurrence','Purpose','janet','ready',3)`);
 let store=new TaskLifecycle(db);const now=Date.now()-10000;
 let eventId=0;const event=(kind:LifecycleEvent['kind'],extra:Partial<LifecycleEvent>={}):LifecycleEvent=>({producer:'gateway',id:'e'+(++eventId),kind,observedAt:now+eventId,summary:'Synthetic proof',nextAction:'Review evidence',...extra});
 assert.equal(store.snapshot().tasks.find(t=>t.id==='pilot')!.state,'queued');assert.equal(store.snapshot().tasks.find(t=>t.id==='legacy')!.state,'unverified');
 store.link('pilot',{goal:{id:'synthetic-goal',title:'Synthetic goal'},project:{id:'synthetic-project',title:'Synthetic project'},why:'Prove state transitions',nextAction:'Verify execution',occurrenceId:'recurrence:1'});
 assert.throws(()=>store.link('recurring',{why:'Purpose',nextAction:'Verify',occurrenceId:'recurrence:1'}));
 assert.throws(()=>store.ingest('pilot',event('start',{runId:'unbound',seq:1}),'gateway'));
 store.ingest('pilot',event('bind',{runId:'run-1'}),'supervisor');
 assert.equal(store.snapshot().tasks.find(t=>t.id==='pilot')!.state,'queued');
 assert.throws(()=>store.ingest('pilot',event('review',{evidence:[{label:'Result',url:'https://example.test/result'}]}),'supervisor'));
 assert.throws(()=>store.ingest('pilot',event('start',{runId:'wrong',seq:1}),'gateway'));
 const start=event('start',{runId:'run-1',seq:1});store.ingest('pilot',start,'gateway');
 const before=store.snapshot();assert.equal(before.tasks.find(t=>t.id==='pilot')!.state,'running');
 assert.deepEqual(store.ingest('pilot',start,'gateway'),{duplicate:true});
 assert.deepEqual(store.ingest('pilot',event('progress',{runId:'run-1',seq:0}),'gateway'),{ignored:true});
 assert.equal(store.snapshot().tasks.find(t=>t.id==='pilot')!.observedAt,start.observedAt);
 assert.throws(()=>store.ingest('pilot',event('unknown' as LifecycleEvent['kind']),'supervisor'));
 store.ingest('pilot',event('end',{runId:'run-1',seq:2}),'gateway');assert.equal(store.snapshot().tasks.find(t=>t.id==='pilot')!.state,'waiting');
 assert.throws(()=>store.ingest('pilot',event('delivered'),'supervisor'));
 assert.throws(()=>store.ingest('pilot',event('review',{evidence:[{label:'Unsafe',url:'javascript:alert(1)'}]}),'supervisor'));
 const evidence=[{label:'Synthetic result',url:'https://example.test/result'}];store.ingest('pilot',event('review',{evidence}),'supervisor');
 const obstacle={reason:'Needs correction',impact:'Not accepted',waitingOn:'Dev',nextOwner:'Dev',recommendation:'Correct result',options:['Correct result','Reconsider scope']};
 store.ingest('pilot',event('reject',{obstacle}),'supervisor');assert.equal(store.snapshot().tasks.find(t=>t.id==='pilot')!.state,'waiting');
 store.ingest('pilot',event('review',{evidence}),'supervisor');
 assert.throws(()=>store.ingest('pilot',event('delivered'),'gateway'));
 db.exec(`CREATE TRIGGER fail_delivery BEFORE UPDATE ON task_lifecycle WHEN NEW.state='delivered' BEGIN SELECT RAISE(ABORT,'injected failure'); END;`);
 const delivered=event('delivered');assert.throws(()=>store.ingest('pilot',delivered,'supervisor'));assert.equal(store.snapshot().tasks.find(t=>t.id==='pilot')!.state,'review');
 assert.equal((db.prepare("SELECT count(*) n FROM task_lifecycle_events WHERE kind='delivered'").get() as {n:number}).n,0);
 db.exec('DROP TRIGGER fail_delivery');store.ingest('pilot',delivered,'supervisor');const revision=store.snapshot().revision;
 db.close();db=new Database(path);store=new TaskLifecycle(db);
 assert.deepEqual(store.ingest('pilot',delivered,'supervisor'),{duplicate:true});assert.deepEqual(store.ingest('pilot',event('delivered'),'supervisor'),{duplicate:true});
 assert.equal(store.snapshot().revision,revision);const task=store.snapshot().tasks.find(t=>t.id==='pilot')!;
 assert.equal(task.history.filter((h:any)=>h.kind==='delivered').length,1);assert.equal(task.reviewer,'Mildred');assert.equal(task.deliveredAt,delivered.observedAt);
 assert.ok(!JSON.stringify(store.snapshot()).includes('run-1'));
 } finally {db.close();rmSync(dir,{recursive:true,force:true});}
});

test('isolated HTTP task creation, assignment, evidence, history and narrow auth boundary',{skip:process.env.MISSION_HTTP_PROOF!=='1'},async()=>{
 const {spawn}=await import('node:child_process');const {randomBytes}=await import('node:crypto');const {once}=await import('node:events');
 const dir=mkdtempSync(join(tmpdir(),'mission-api-'));const token=randomBytes(32).toString('hex');const readerToken=randomBytes(32).toString('hex');
 const port=3379;const base=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['--import',new URL('../node_modules/tsx/dist/loader.mjs',import.meta.url).pathname,new URL('../server/index.ts',import.meta.url).pathname],{env:{...process.env,NODE_ENV:'production',PORT:String(port),DATA_DIR:dir,UPLOAD_DIR:join(dir,'uploads'),GATEWAY_TOKEN:'',GITHUB_TOKEN:'',COMMAND_CENTER_AUTH_TOKEN:token,COMMAND_CENTER_SNAPSHOT_TOKEN:readerToken,COMMAND_CENTER_AUTH_EMAILS:'',COMMAND_CENTER_ENABLE_HIGH_RISK_ACTIONS:'0'},stdio:['ignore','pipe','pipe']});
 const exited=once(child,'exit');let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
 const call=(path:string,method='GET',body?:unknown)=>fetch(base+path,{method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 try {
  for(let i=0;i<60;i++){if(child.exitCode!==null)throw Error('Fixture exited: '+logs);try{if((await call('/api/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  if(!logs.includes('Command Center API running')) throw Error('Fixture startup did not finish: '+logs);
  assert.equal((await fetch(base+'/api/mission-control')).status,401);
  assert.equal((await fetch(base+'/api/mission-control',{headers:{'x-forwarded-email':'Mildred',host:'localhost'}})).status,401);
  const create=await call('/api/tasks','POST',{title:'Synthetic API task',description:'Test only',status:'ready'});assert.equal(create.status,201);const task=await create.json() as {id:string};
  assert.equal((await call(`/api/tasks/${task.id}/assign`,'POST',{agent_id:'dev'})).status,200);
  const list=await (await call('/api/tasks')).json() as {id:string}[];assert.ok(list.some(t=>t.id===task.id));
  const detail=await (await call(`/api/tasks/${task.id}`)).json() as {history:{event_type:string}[]};assert.ok(detail.history.some(e=>e.event_type==='assigned'));
  const form=new FormData();form.append('file',new Blob(['Synthetic API evidence'],{type:'text/plain'}),'proof.txt');
  assert.equal((await fetch(base+`/api/tasks/${task.id}/evidence`,{method:'POST',headers:{authorization:`Bearer ${token}`},body:form})).status,201);
  const snapshot=await (await call('/api/mission-control')).json() as {tasks:{state:string}[]};assert.equal(snapshot.tasks[0].state,'queued');
  assert.equal((await call(`/api/tasks/${task.id}/lifecycle/link`,'POST',{why:'Synthetic proof',nextAction:'Verify actual execution'})).status,201);
  assert.equal((await call(`/api/tasks/${task.id}/lifecycle`,'POST',{producer:'supervisor',id:'premature-delivery',kind:'delivered',observedAt:Date.now(),summary:'Not delivered',nextAction:'Review'})).status,409);
  assert.equal((await call('/api/gateway/send','POST',{})).status,403);
  const readHeaders={authorization:`Bearer ${readerToken}`,'content-type':'application/json',host:'localhost','x-forwarded-email':'Mildred'};
  const read=await fetch(base+'/api/mission-control',{headers:readHeaders});assert.equal(read.status,200);assert.equal(read.headers.get('cache-control'),'no-store');
  for(const route of ['/api/tasks','/api/tasks/'+task.id+'/lifecycle','/api/tasks/'+task.id+'/lifecycle/link','/api/tasks/'+task.id+'/approve','/api/gateway/send']) {
    assert.equal((await fetch(base+route,{method:'POST',headers:readHeaders,body:'{}'})).status,401,route);
  }
  assert.equal((await fetch(base+'/api/tasks',{headers:readHeaders})).status,401);
  // Genuine cross-app adapter + HTTP boundary, not a mocked fetch. Data remains synthetic.
  const {fetchWorkSnapshot}=await import(new URL('../../engine-mission-control-20261107/src/lib/mission-control.ts',import.meta.url).href);
  const projected=await fetchWorkSnapshot({url:base+'/api/mission-control',token:readerToken});
  assert.equal(projected.version,1);assert.equal(projected.tasks.find((t:any)=>t.id===task.id).state,'queued');
  assert.equal(projected.tasks.find((t:any)=>t.id===task.id).owner,'dev');
  assert.ok(!JSON.stringify(projected).includes(readerToken));assert.ok(!JSON.stringify(projected).includes(token));

  assert.equal((await fetch(base+'/api/mission-control',{method:'HEAD',headers:readHeaders})).status,401);

 } finally {child.kill('SIGTERM');await exited;rmSync(dir,{recursive:true,force:true});}
});

test('gateway parser preserves producer sequence/source time and distinguishes run end',async()=>{
 const {GatewayClient}=await import('../server/gateway-client.js');
 const client=new GatewayClient('ws://127.0.0.1:1','synthetic-only');
 const parse=(client as unknown as {parseEvent:(id:string,event:unknown)=>{seq:number;observedAt:number;stream:string;phase:string;status:string}}).parseEvent.bind(client);
 const start=parse('dev',{runId:'synthetic-run',seq:7,ts:123456,stream:'lifecycle',data:{phase:'start'}});
 assert.equal(start.seq,7);assert.equal(start.observedAt,123456);assert.equal(start.phase,'start');assert.equal(start.status,'thinking');
 const end=parse('dev',{runId:'synthetic-run',seq:8,ts:123457,stream:'lifecycle',data:{phase:'end'}});assert.equal(end.status,'idle');assert.equal(end.phase,'end');
 const unknown=parse('dev',{runId:'synthetic-run',seq:9,ts:123458,stream:'unrecognized',data:{}});assert.equal(unknown.stream,'unrecognized');assert.equal(unknown.status,'idle');
});

test('real Express middleware/routes via in-process synthetic requests (no network)',async()=>{
 const {IncomingMessage,ServerResponse}=await import('node:http');const {Socket}=await import('node:net');const {randomBytes}=await import('node:crypto');
 const dir=mkdtempSync(join(tmpdir(),'mission-inprocess-'));const token=randomBytes(32).toString('hex');
 const saved={...process.env};Object.assign(process.env,{NODE_ENV:'test',DATA_DIR:dir,UPLOAD_DIR:join(dir,'uploads'),GATEWAY_TOKEN:'',GITHUB_TOKEN:'',COMMAND_CENTER_AUTH_TOKEN:token,COMMAND_CENTER_AUTH_EMAILS:'',COMMAND_CENTER_ENABLE_HIGH_RISK_ACTIONS:'0'});
 const {app,db}=await import('../server/index.js');
 async function call(url:string,method='GET',body?:unknown,authorized=true):Promise<{status:number;body:any;headers:unknown}> {
  return new Promise((resolve,reject)=>{
   const req=new IncomingMessage(new Socket());req.method=method;req.url=url;req.headers={host:'fixture.invalid',...(authorized?{authorization:`Bearer ${token}`}:{})};
   if(body!==undefined){const data=Buffer.from(JSON.stringify(body));req.headers['content-type']='application/json';req.headers['content-length']=String(data.length);req.push(data);}req.push(null);
   const res=new ServerResponse(req);const timer=setTimeout(()=>reject(Error('Route did not finish')),2000);
   res.end=((chunk?:unknown)=>{clearTimeout(timer);let parsed;try{parsed=chunk?JSON.parse(String(chunk)):null;}catch{parsed=String(chunk)}resolve({status:res.statusCode,body:parsed,headers:res.getHeaders()});return res;}) as typeof res.end;
   app(req,res);
  });
 }
 try {
  assert.equal((await call('/api/mission-control','GET',undefined,false)).status,401);
  const created=await call('/api/tasks','POST',{title:'Synthetic API proof',description:'Fixture only',status:'ready'});assert.equal(created.status,201);const id=created.body.id;
  assert.equal((await call(`/api/tasks/${id}/assign`,'POST',{agent_id:'dev'})).status,200);
  const detail=await call(`/api/tasks/${id}`);assert.equal(detail.status,200);assert.ok(detail.body.history.some((e:any)=>e.event_type==='assigned'));
  assert.equal((await call('/api/tasks')).body.length,1);
  assert.equal((await call('/api/mission-control')).body.tasks[0].state,'queued');
  assert.equal((await call(`/api/tasks/${id}/lifecycle/link`,'POST',{why:'Proof',nextAction:'Verify execution'})).status,201);
  assert.equal((await call(`/api/tasks/${id}/lifecycle`,'POST',{producer:'supervisor',id:'premature',kind:'delivered',observedAt:Date.now(),summary:'Premature delivery',nextAction:'Review'})).status,409);
  assert.equal((await call(`/api/tasks/${id}/approve`,'POST',{notes:'Legacy reported complete'})).status,200);
  assert.notEqual((await call('/api/mission-control')).body.tasks[0].state,'delivered');
  assert.equal((await call('/api/gateway/send','POST',{})).status,403);
 } finally {db.close();for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved);rmSync(dir,{recursive:true,force:true});}
});

test('current gateway terminal error and envelope identity reach durable waiting without leaking payloads',async()=>{
 const {GatewayClient}=await import('../server/gateway-client.js');
 const {lifecycleEventFromGateway}=await import('../server/task-events.js');
 const client=new GatewayClient('ws://127.0.0.1:1','synthetic-only');
 const emitted:any[]=[];client.onAgentEvent(e=>emitted.push(e));
 const dispatch=(client as unknown as {processAgentEvent:(event:unknown)=>void}).processAgentEvent.bind(client);
 const db=new Database(':memory:');
 try {
  db.exec(`CREATE TABLE tasks(id TEXT PRIMARY KEY,title TEXT,description TEXT,agent_id TEXT,status TEXT,created_at INTEGER); INSERT INTO tasks VALUES('task','Synthetic gateway contract','Proof','dev','ready',1)`);
  const store=new TaskLifecycle(db);const now=Date.now()-1000;
  store.link('task',{why:'Verify actual gateway terminal shape',nextAction:'Wait for execution'});
  store.ingest('task',{producer:'gateway',id:'bind',kind:'bind',runId:'native-run',observedAt:now,summary:'Synthetic binding',nextAction:'Verify start'},'supervisor');
  dispatch({runId:'native-run',agentId:'dev',sessionKey:'codex-thread:synthetic',seq:1,ts:now+1,stream:'lifecycle',data:{phase:'start',startedAt:now+1}});
  assert.equal(emitted.length,1);assert.equal(emitted[0].agentId,'dev');
  store.ingest('task',lifecycleEventFromGateway(emitted[0])!,'gateway');
  dispatch({runId:'native-run',agentId:'dev',seq:2,ts:now+2,stream:'lifecycle',data:{phase:'error',error:'PRIVATE RAW ERROR',executionSettled:true}});
  assert.equal(emitted[1].status,'error');const failure=lifecycleEventFromGateway(emitted[1])!;
  assert.equal(failure.kind,'failed');store.ingest('task',failure,'gateway');
  assert.equal(store.snapshot().tasks[0].state,'waiting');assert.equal(store.snapshot().tasks[0].obstacle.nextOwner,'Mildred');
  assert.ok(!JSON.stringify(store.snapshot()).includes('PRIVATE RAW ERROR'));
  assert.deepEqual(store.ingest('task',failure,'gateway'),{duplicate:true});
  assert.equal(lifecycleEventFromGateway({...emitted[1],stream:'error',seq:undefined}),null);
  assert.equal(lifecycleEventFromGateway({...emitted[1],phase:'finishing'}),null);
 } finally {db.close();}
});

test('equal snapshot/supervisor configuration fails closed before localhost bypass',{skip:process.env.MISSION_HTTP_PROOF!=='1'},async()=>{
 const {execFileSync}=await import('node:child_process');
 const {randomBytes}=await import('node:crypto');
 const dir=mkdtempSync(join(tmpdir(),'mission-equal-credentials-'));
 const token=randomBytes(32).toString('hex');
 try {
  execFileSync(process.execPath,['--import','tsx','--input-type=module','-e',`
   import assert from 'node:assert/strict';
   import {app,db} from './server/index.ts';
   const server=app.listen(0,'127.0.0.1');
   await new Promise(resolve=>server.once('listening',resolve));
   try {
    for(const path of ['/api/mission-control','/api/tasks']) {
     const response=await fetch('http://127.0.0.1:'+server.address().port+path,{headers:{authorization:'Bearer '+process.env.COMMAND_CENTER_SNAPSHOT_TOKEN,host:'localhost'}});
     assert.equal(response.status,401);
    }
   } finally {await new Promise(resolve=>server.close(resolve));db.close();}
  `],{cwd:new URL('..',import.meta.url),env:{...process.env,NODE_ENV:'test',DATA_DIR:dir,UPLOAD_DIR:join(dir,'uploads'),GATEWAY_TOKEN:'',GITHUB_TOKEN:'',COMMAND_CENTER_AUTH_TOKEN:token,COMMAND_CENTER_SNAPSHOT_TOKEN:token,COMMAND_CENTER_AUTH_EMAILS:''},timeout:10000,stdio:'pipe'});
 } finally {rmSync(dir,{recursive:true,force:true});}
});
