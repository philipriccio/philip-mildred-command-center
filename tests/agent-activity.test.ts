import {test} from 'node:test';import assert from 'node:assert/strict';
import {AgentActivitySource,safeJobDescription,type ActivityRpc} from '../server/agent-activity.js';
const row=(ids:string[]=[])=>({key:'agent:main:telegram:direct:test',agentId:'main',hasActiveRun:!!ids.length,status:ids.length?'running':'completed',activeRunIds:ids,privatePrompt:'never export',label:'raw secret title'});
function fixture(options:ConstructorParameters<typeof AgentActivitySource>[1]={}){let rows:unknown[]=[];let now=1000;let fail=false;const calls:string[]=[];const rpc:ActivityRpc={async request(method,p){calls.push(method);if(fail)throw Error('private error');if(method==='sessions.subscribe')return {subscribed:true};const list=p.agentId==='main'?rows:[];return {sessions:list,count:list.length,totalCount:list.length,hasMore:false};}};const source=new AgentActivitySource(rpc,{now:()=>now,...options});return {source,calls,setRows:(v:unknown[])=>{rows=v;},tick:()=>{now+=16000;},fail:()=>{fail=true;}};}
test('partial coverage cannot assert idle; explicit full coverage can',async()=>{const f=fixture();await f.source.connect();assert.equal(f.source.snapshot().agents[0].status,'unknown');const full=fixture({fullCoverage:['main','dev','janet']});await full.source.connect();assert.ok(full.source.snapshot().agents.every(a=>a.status==='idle'));});
test('direct main work, simultaneous runs and completion reconcile authoritatively',async()=>{const f=fixture({fullCoverage:['main'],describe:()=> 'Connect the team activity display to OpenClaw'});f.setRows([row(['one','two'])]);await f.source.connect();assert.equal(f.source.snapshot().agents[0].jobs.length,2);f.setRows([row(['two'])]);f.source.invalidate();assert.equal(f.source.snapshot().agents[0].status,'unknown');await f.source.refresh();assert.equal(f.source.snapshot().agents[0].status,'working');f.setRows([row()]);await f.source.refresh();assert.equal(f.source.snapshot().agents[0].status,'idle');assert.ok(!JSON.stringify(f.source.snapshot()).includes('privatePrompt'));});
test('disconnect, stale and failed reconciliation never become idle',async()=>{const f=fixture({fullCoverage:['main']});await f.source.connect();f.tick();assert.equal(f.source.snapshot().agents[0].status,'disconnected');await f.source.refresh();f.fail();await f.source.refresh();assert.equal(f.source.snapshot().agents[0].status,'unknown');f.source.disconnect();assert.equal(f.source.snapshot().state,'disconnected');});
test('wrong identity, contradictory run flag and duplicated session are rejected',async()=>{for(const rows of [[{...row(),agentId:'dev'}],[{...row(),hasActiveRun:true}],[row(),row()],[{...row(),key:'agent:dev:direct:x'}]]){const f=fixture({fullCoverage:['main']});f.setRows(rows);await f.source.connect();assert.equal(f.source.snapshot().agents[0].status,'unknown');}});
test('safe descriptions never copy arbitrary source metadata',()=>{for(const value of ['token=abc123456789','https://private.example','/Users/private','Send to test@example.com','abc\npassword','a'.repeat(161)])assert.match(safeJobDescription(value),/not available/);assert.equal(safeJobDescription('Check the Engine Room activity display'),'Check the Engine Room activity display');});
test('late response after disconnect cannot revive connection',async()=>{let resolve:(v:unknown)=>void=()=>{};const source=new AgentActivitySource({request:async()=>new Promise(r=>{resolve=r;})});const run=source.connect();source.disconnect();resolve({subscribed:true});await run;assert.equal(source.snapshot().state,'disconnected');});
test('truncated result is unknown, not idle',async()=>{const source=new AgentActivitySource({request:async m=>m==='sessions.subscribe'?{subscribed:true}:{sessions:[],count:0,totalCount:1001,hasMore:true}},{fullCoverage:['main']});await source.connect();assert.equal(source.snapshot().agents[0].status,'unknown');});
test('reconnect replaces old runs rather than retaining a vanished run',async()=>{const f=fixture({fullCoverage:['main']});f.setRows([row(['old'])]);await f.source.connect();assert.equal(f.source.snapshot().agents[0].status,'working');f.source.disconnect();f.setRows([row()]);await f.source.connect();assert.equal(f.source.snapshot().agents[0].status,'idle');assert.equal(f.source.snapshot().agents[0].jobs.length,0);});
test('one denied agent does not mask direct work on a permitted agent',async()=>{const source=new AgentActivitySource({request:async(method,p)=>{if(method==='sessions.subscribe')return {subscribed:true};if(p.agentId==='dev')throw Error('Denied');const sessions=p.agentId==='main'?[row(['active'])]:[];return {sessions,count:sessions.length,totalCount:sessions.length,hasMore:false};}},{fullCoverage:['main','dev','janet']});await source.connect();const agents=source.snapshot().agents;assert.equal(agents[0].status,'working');assert.equal(agents[1].status,'unknown');assert.equal(agents[2].status,'idle');});

test('actual projected and embedded missing-ID shapes remain unknown, not false working or idle',async()=>{
 for(const status of ['running','queued']){
  const f=fixture({fullCoverage:['main']});
  f.setRows([{...row(['private-run']),activeRunIds:undefined,status}]);
  await f.source.connect();assert.equal(f.source.snapshot().agents[0].status,'unknown');assert.deepEqual(f.source.snapshot().agents[0].jobs,[]);
 }
});
test('explicit queued tracked runs are not execution even with concrete IDs',async()=>{
 const f=fixture({fullCoverage:['main']});f.setRows([{...row(['queued-run']),status:'queued'}]);
 await f.source.connect();assert.equal(f.source.snapshot().agents[0].status,'unknown');
});
test('fresh inactive flag with omitted IDs permits covered idle despite historical status',async()=>{
 const f=fixture({fullCoverage:['main']});f.setRows([{...row(),activeRunIds:undefined,status:'running'}]);
 await f.source.connect();assert.equal(f.source.snapshot().agents[0].status,'idle');
 const partial=fixture();partial.setRows([{...row(),activeRunIds:undefined}]);await partial.source.connect();assert.equal(partial.source.snapshot().agents[0].status,'unknown');
});
test('ambiguous session does not hide separately confirmed execution or become idle when execution ends',async()=>{
 const f=fixture({fullCoverage:['main']});const ambiguous={...row(['unavailable']),key:'agent:main:other',activeRunIds:undefined};
 f.setRows([ambiguous,row(['confirmed'])]);await f.source.connect();assert.equal(f.source.snapshot().agents[0].status,'working');assert.equal(f.source.snapshot().agents[0].jobs.length,1);
 f.setRows([ambiguous,row()]);await f.source.refresh();assert.equal(f.source.snapshot().agents[0].status,'unknown');
});
test('active run IDs with absent or terminal status cannot assert execution',async()=>{
 for(const status of [undefined,'completed','failed']){const f=fixture({fullCoverage:['main']});f.setRows([{...row(['run']),status}]);await f.source.connect();assert.equal(f.source.snapshot().agents[0].status,'unknown');}
});

test('current-connection execution corroborates missing IDs, terminal removal immediately removes Working',async()=>{
 let evidence:string[]=['native-execution'];const f=fixture({fullCoverage:['main'],executionEvidence:()=>evidence});
 f.setRows([{...row(['native']),activeRunIds:undefined}]);await f.source.connect();assert.equal(f.source.snapshot().agents[0].status,'working');
 f.tick();await f.source.refresh();assert.equal(f.source.snapshot().agents[0].status,'working','fresh snapshots sustain observed execution during silent thinking');
 evidence=[];assert.equal(f.source.snapshot().agents[0].status,'unknown','terminal evidence wins before snapshot settles');
 f.setRows([row()]);await f.source.refresh();assert.equal(f.source.snapshot().agents[0].status,'idle');
});
test('execution corroboration cannot override queued, inactive, stale or disconnected snapshots',async()=>{
 const f=fixture({fullCoverage:['main'],executionEvidence:()=>['native']});
 f.setRows([{...row(['native']),activeRunIds:undefined,status:'queued'}]);await f.source.connect();assert.equal(f.source.snapshot().agents[0].status,'unknown');
 f.setRows([row()]);await f.source.refresh();assert.equal(f.source.snapshot().agents[0].status,'idle');
 f.setRows([{...row(['native']),activeRunIds:undefined}]);await f.source.refresh();assert.equal(f.source.snapshot().agents[0].status,'working');
 f.tick();assert.equal(f.source.snapshot().agents[0].status,'disconnected');f.source.disconnect();assert.equal(f.source.snapshot().agents[0].status,'disconnected');
});
test('malformed or throwing corroboration remains unknown and cannot leak raw identity',async()=>{
 for(const executionEvidence of [()=>[''],()=>['duplicate','duplicate'],()=>{throw Error('private');}]){
  const f=fixture({executionEvidence,fullCoverage:['main']});f.setRows([{...row(['native']),activeRunIds:undefined}]);await f.source.connect();assert.equal(f.source.snapshot().agents[0].status,'unknown');
 }
 const f=fixture({executionEvidence:()=>['private-run-id']});f.setRows([{...row(['native']),activeRunIds:undefined}]);await f.source.connect();assert.ok(!JSON.stringify(f.source.snapshot()).includes('private-run-id'));
});
