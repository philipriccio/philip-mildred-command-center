import {test} from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {mkdtempSync,rmSync,readFileSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {acceptNativeTask,initializeNativeTaskReviewLedger,nativeTaskLifecycleFingerprint,openNativeTaskReviewProjection,type NativeReviewTask,type NativeTaskAcceptanceInput} from '../server/native-task-review.js';

function fixture() {
 const dir=mkdtempSync(join(tmpdir(),'native-review-ledger-')),path=join(dir,'native-task-reviews.sqlite');
 initializeNativeTaskReviewLedger(path);
 const now=Date.now();
 const task:NativeReviewTask={ownerSession:'agent:main:test',taskId:'run-1',runtime:'subagent',agentId:'dev',status:'succeeded',terminalOutcome:null,createdAt:now-3000,startedAt:now-2000,endedAt:now-1000};
 const input:NativeTaskAcceptanceInput={lifecycleFingerprint:nativeTaskLifecycleFingerprint(task),reviewer:'Mildred',summary:'Reviewed test output.',nextAction:'Archive reviewed result.',evidence:[{label:'Test report',url:'https://example.com/report'}]};
 return {dir,path,task,input,dispose(){rmSync(dir,{recursive:true,force:true});}};
}

test('explicit local acceptance persists across reopen; projection returns only reviewed fields',()=>{
 const f=fixture();try {
  let projection=openNativeTaskReviewProjection(f.path);assert.equal(projection.read(f.task),null);projection.close();
  const accepted=acceptNativeTask(f.path,f.task,f.input);
  projection=openNativeTaskReviewProjection(f.path);
  assert.deepEqual(projection.read(f.task),accepted);assert.equal('ownerSession' in accepted,false);
  const detached=projection.read(f.task)!;detached.evidence.length=0;
  assert.equal(projection.read(f.task)!.evidence.length,1);projection.close();
 }finally{f.dispose();}
});

test('all lifecycle and scope changes mask acceptance; notification bookkeeping neither creates nor invalidates it',()=>{
 const f=fixture();try {
  const p=openNativeTaskReviewProjection(f.path);
  const notified={...f.task,delivery_status:'delivered',last_event_at:Date.now()};
  assert.equal(p.read(notified),null);acceptNativeTask(f.path,f.task,f.input);
  assert.ok(p.read(notified));
  for(const patch of [
   {ownerSession:'agent:main:elsewhere'},{taskId:'run-2'},{runtime:'acp'},{agentId:'other'},{status:'failed'},
   {terminalOutcome:'blocked'},{createdAt:f.task.createdAt-1},{startedAt:f.task.startedAt!-1},{endedAt:f.task.endedAt!-1},
   {status:'running'},{status:'queued'},{endedAt:null},{startedAt:f.task.createdAt-1},
  ])assert.equal(p.read({...f.task,...patch} as NativeReviewTask),null,JSON.stringify(patch));
  p.close();
 }finally{f.dispose();}
});

test('duplicate or contradictory review is rejected transactionally, including after restart',()=>{
 const f=fixture();try {
  acceptNativeTask(f.path,f.task,f.input);
  for(const input of [f.input,{...f.input,summary:'Contradiction'},{...f.input,reviewer:'Someone else'}])assert.throws(()=>acceptNativeTask(f.path,f.task,input),/Duplicate or contradictory/);
  const changed={...f.task,endedAt:f.task.endedAt!+1};
  assert.throws(()=>acceptNativeTask(f.path,changed,{...f.input,lifecycleFingerprint:nativeTaskLifecycleFingerprint(changed)}),/Duplicate or contradictory/);
  const db=new Database(f.path);assert.equal((db.prepare('SELECT count(*) n FROM native_task_acceptances').get() as {n:number}).n,1);
  assert.throws(()=>db.exec("UPDATE native_task_acceptances SET reviewer='other'"),/immutable/);
  assert.throws(()=>db.exec('DELETE FROM native_task_acceptances'),/immutable/);db.close();
 }finally{f.dispose();}
});

test('invalid or missing evidence, unsafe links, unbounded text and fingerprint mismatch cannot write',()=>{
 const f=fixture();try {
  for(const evidence of [[],undefined,[{label:'',url:'https://example.com'}],
   ...['http://example.com','javascript:alert(1)','file:///tmp/test','https://user:pass@example.com','https://example.com/?secret=1','https://example.com/#secret','https://example.com/'+ 'x'.repeat(2048)].map(url=>[{label:'Evidence',url}]),
   Array.from({length:21},(_,i)=>({label:'Evidence',url:`https://example.com/${i}`})),[...f.input.evidence,...f.input.evidence],
  ])assert.throws(()=>acceptNativeTask(f.path,f.task,{...f.input,evidence} as NativeTaskAcceptanceInput));
  for(const patch of [{reviewer:''},{summary:''},{nextAction:''},{summary:'x'.repeat(2001)},{lifecycleFingerprint:'0'.repeat(64)}])assert.throws(()=>acceptNativeTask(f.path,f.task,{...f.input,...patch}));
  const p=openNativeTaskReviewProjection(f.path);assert.equal(p.read(f.task),null);p.close();
 }finally{f.dispose();}
});

test('nonterminal and contradictory native facts cannot be accepted',()=>{
 const f=fixture();try {
  for(const patch of [{status:'queued'},{status:'running'},{status:'unknown'},{endedAt:null},{startedAt:null},
   {startedAt:f.task.createdAt-1},{endedAt:f.task.createdAt-1},{createdAt:NaN},{endedAt:Date.now()+60000},
   {ownerSession:'agent:dev:test'},{runtime:'cron'},
  ])assert.throws(()=>acceptNativeTask(f.path,{...f.task,...patch} as NativeReviewTask,f.input));
  for(const status of ['failed','timed_out','cancelled','lost']) {
   const task={...f.task,taskId:status,status,startedAt:null};
   acceptNativeTask(f.path,task,{...f.input,lifecycleFingerprint:nativeTaskLifecycleFingerprint(task)});
  }
 }finally{f.dispose();}
});

test('projection has no SQL/write capability, enforces SQLite readonly, and leaves file unchanged',()=>{
 const f=fixture();try {
  acceptNativeTask(f.path,f.task,f.input);
  const before=readFileSync(f.path),p=openNativeTaskReviewProjection(f.path);
  assert.deepEqual(Object.keys(p).sort(),['close','read']);assert.ok(Object.isFrozen(p));
  assert.throws(()=>Object.assign(p,{write(){}}),TypeError);
  // Same driver flags as the projection's private connection: even disabling query_only cannot grant writes.
  const db=new Database(f.path,{readonly:true,fileMustExist:true});db.pragma('query_only = ON');
  assert.throws(()=>db.exec('CREATE TABLE illicit(id INTEGER)'),/readonly/);
  db.pragma('query_only = OFF');assert.throws(()=>db.exec('CREATE TABLE illicit(id INTEGER)'),/readonly/);db.close();
  for(let i=0;i<10;i++)assert.ok(p.read(f.task));p.close();assert.deepEqual(readFileSync(f.path),before);
 }finally{f.dispose();}
});

test('malformed stored evidence or duplicate legacy rows are masked without exposing review',()=>{
 const f=fixture();try {
  acceptNativeTask(f.path,f.task,f.input);const db=new Database(f.path);
  db.exec('DROP TRIGGER native_review_no_update');
  db.prepare('UPDATE native_task_acceptances SET evidence_json=?').run('[]');
  db.exec("CREATE TRIGGER native_review_no_update BEFORE UPDATE ON native_task_acceptances BEGIN SELECT RAISE(ABORT,'immutable'); END");
  const p=openNativeTaskReviewProjection(f.path);assert.equal(p.read(f.task),null);p.close();
  // Simulate a corrupt/legacy table without the uniqueness constraint: reader must mask duplicates.
  db.exec('DROP TRIGGER native_review_no_update; DROP TRIGGER native_review_no_delete; ALTER TABLE native_task_acceptances RENAME TO old; CREATE TABLE native_task_acceptances AS SELECT * FROM old; INSERT INTO native_task_acceptances SELECT * FROM old; DROP TABLE old;');
  db.exec("CREATE TRIGGER native_review_no_update BEFORE UPDATE ON native_task_acceptances BEGIN SELECT RAISE(ABORT,'immutable'); END; CREATE TRIGGER native_review_no_delete BEFORE DELETE ON native_task_acceptances BEGIN SELECT RAISE(ABORT,'immutable'); END;");
  db.close();const duplicate=openNativeTaskReviewProjection(f.path);assert.equal(duplicate.read(f.task),null);duplicate.close();
 }finally{f.dispose();}
});

test('dedicated setup refuses existing files, foreign schemas, symlinks and missing readers',()=>{
 const f=fixture();try {
  assert.throws(()=>initializeNativeTaskReviewLedger(f.path),/EEXIST/);
  assert.throws(()=>initializeNativeTaskReviewLedger(join(f.dir,'native-registry.sqlite')),/Dedicated/);
  assert.throws(()=>openNativeTaskReviewProjection(join(f.dir,'missing','native-task-reviews.sqlite')));
  const foreignDir=mkdtempSync(join(f.dir,'foreign-')),foreign=join(foreignDir,'native-task-reviews.sqlite');
  const db=new Database(foreign);db.exec('CREATE TABLE task_runs(task_id TEXT)');db.close();const bytes=readFileSync(foreign);
  assert.throws(()=>acceptNativeTask(foreign,f.task,f.input),/dedicated/);assert.deepEqual(readFileSync(foreign),bytes);
  const linkDir=mkdtempSync(join(f.dir,'link-')),link=join(linkDir,'native-task-reviews.sqlite');symlinkSync(f.path,link);
  assert.throws(()=>openNativeTaskReviewProjection(link),/regular file/);
 }finally{f.dispose();}
});
