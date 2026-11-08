import {test} from 'node:test';import assert from 'node:assert/strict';
import {createGatewayActivityReader,type ReaderClientOptions} from '../server/gateway-activity-reader.js';
const settle=()=>new Promise(resolve=>setTimeout(resolve,20));
async function fixture(){let callbacks!:ReaderClientOptions;let active=true,fail=false,denyDev=false,stops=0;let now=100000;const calls:string[]=[];
 const reader=await createGatewayActivityReader(()=>({tasks:[]}),{fullCoverage:['main','dev','janet'],describe:()=> 'Connect Engine Room to live agent activity',now:()=>now,clientFactory:opts=>{callbacks=opts;return {start(){},stop(){stops++;},async request(method,params){calls.push(method);if(fail)throw Error('private source text');if(method==='sessions.subscribe')return {subscribed:true};if(denyDev&&params.agentId==='dev')throw Object.assign(Error('denied'),{code:'MISSING_SCOPE'});const sessions=params.agentId==='main'?[{key:'agent:main:test',agentId:'main',hasActiveRun:active,status:active?'running':'idle',...(active?{}:{activeRunIds:[]})}]:[];return {sessions,count:sessions.length,totalCount:sessions.length,hasMore:false};}};}});
 const event=(extra:Record<string,unknown>={},event='session.tool')=>callbacks.onEvent({event,payload:{agentId:'main',sessionKey:'agent:main:test',runId:'run-one',ts:now,stream:'tool',data:{phase:'start',arguments:'private source text'},...extra}});
 return {reader,callbacks,calls,event,getStops:()=>stops,idle:()=>{active=false;},fail:()=>{fail=true;},denyDev:()=>{denyDev=true;},advance:()=>{now+=61000;},connect:async()=>{callbacks.onHelloOk({auth:{scopes:['operator.read']}});await settle();}};
}
test('read-only options, real tool shape, readable description and terminal evidence',async()=>{const f=await fixture();try{
 assert.deepEqual(f.callbacks.scopes,['operator.read']);assert.equal(f.callbacks.sharedStateMode,'read-only');await f.connect();
 assert.equal((await f.reader.snapshot()).activity.agents[0].status,'unknown');f.event();await settle();
 const snap=await f.reader.snapshot();assert.equal(snap.activity.agents[0].status,'working');assert.deepEqual(snap.activity.agents[0].jobs,['Connect Engine Room to live agent activity']);assert.ok(!JSON.stringify(snap).includes('private source text'));assert.ok(!JSON.stringify(snap).includes('run-one'));
 f.event({phase:'end'},'sessions.changed');await settle();assert.equal((await f.reader.snapshot()).activity.agents[0].status,'unknown');
 f.event();await settle();assert.equal((await f.reader.snapshot()).activity.agents[0].status,'unknown');
 assert.ok(f.calls.every(c=>['sessions.list','sessions.subscribe'].includes(c)));
 }finally{f.reader.close();}});
test('disconnect/reconnect discards old evidence, explicit inactive snapshot confirms idle',async()=>{const f=await fixture();try{await f.connect();f.event();await settle();f.callbacks.onClose();assert.equal((await f.reader.snapshot()).activity.agents[0].status,'disconnected');await f.connect();assert.equal((await f.reader.snapshot()).activity.agents[0].status,'unknown');f.idle();f.event();await settle();assert.equal((await f.reader.snapshot()).activity.agents[0].status,'idle');}finally{f.reader.close();}});
test('invalid identity, stale/future timestamps and unrelated stream cannot prove work',async()=>{const f=await fixture();try{await f.connect();for(const payload of [{agentId:'dev'},{ts:102001},{ts:100},{stream:'assistant'},{runId:''}]){f.event(payload);await settle();assert.equal((await f.reader.snapshot()).activity.agents[0].status,'unknown');}f.event();await settle();assert.equal((await f.reader.snapshot()).activity.agents[0].status,'working');f.advance();f.event({phase:'end'},'sessions.changed');await settle();assert.equal((await f.reader.snapshot()).activity.agents[0].status,'unknown');}finally{f.reader.close();}});
test('failed RPC disconnects and broader hello scopes are refused',async()=>{const f=await fixture();try{await f.connect();f.fail();f.event();await settle();assert.equal((await f.reader.snapshot()).activity.agents[0].status,'disconnected');assert.ok(f.getStops()>0);f.callbacks.onHelloOk({auth:{scopes:['operator.read','operator.admin']}});assert.equal((await f.reader.snapshot()).activity.state,'disconnected');}finally{f.reader.close();}});
test('unreviewed module import fails closed',async()=>{await assert.rejects(createGatewayActivityReader(()=>({}),{clientModulePath:'/tmp/unreviewed.js'}),/Reviewed Gateway client module required/);});

test('agent denial preserves successful observations and silent active runs retain admitted evidence',async()=>{const f=await fixture();try{f.denyDev();await f.connect();f.event();await settle();assert.equal((await f.reader.snapshot()).activity.agents[0].status,'working');assert.equal((await f.reader.snapshot()).activity.agents[1].status,'unknown');f.advance();f.callbacks.onEvent({event:'sessions.changed',payload:{agentId:'main',sessionKey:'agent:main:test',runId:'other',phase:'end',ts:161000}});await settle();assert.equal((await f.reader.snapshot()).activity.agents[0].status,'working');assert.equal(f.getStops(),0);}finally{f.reader.close();}});
test('native committed execution metadata proves work without reading content',async()=>{const f=await fixture();try{await f.connect();let seq=1;
 const emit=(role='assistant',stopReason='toolUse',extra:Record<string,unknown>={})=>{
  const message={role,stopReason,timestamp:100000,__openclaw:{runId:'native-turn',recordTimestampMs:100000,seq:seq++,mirrorOrigin:'codex-app-server'},...extra};
  Object.defineProperty(message,'content',{get(){throw Error('Content must never be inspected');}});
  f.callbacks.onEvent({event:'session.message',payload:{agentId:'main',sessionKey:'agent:main:test',hasActiveRun:true,status:'running',message}});
 };
 emit('user');await settle();assert.equal((await f.reader.snapshot()).activity.agents[0].status,'unknown');
 emit('assistant','toolUse',{__openclaw:{runId:'native-turn',recordTimestampMs:100000,seq:seq++,mirrorOrigin:'codex-catalog-import'}});await settle();assert.equal((await f.reader.snapshot()).activity.agents[0].status,'unknown');
 emit('assistant','toolUse',{timestamp:1});await settle();assert.equal((await f.reader.snapshot()).activity.agents[0].status,'unknown');
 emit();await settle();assert.equal((await f.reader.snapshot()).activity.agents[0].status,'working');
 emit('toolResult');await settle();assert.equal((await f.reader.snapshot()).activity.agents[0].status,'working');
 emit('assistant','stop');await settle();assert.equal((await f.reader.snapshot()).activity.agents[0].status,'unknown');
 emit('toolResult');await settle();assert.equal((await f.reader.snapshot()).activity.agents[0].status,'unknown');
 }finally{f.reader.close();}});
