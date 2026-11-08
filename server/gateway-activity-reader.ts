import {createLiveActivityProvider} from './live-activity-provider.js';
import {activityAgents,type ActivityAgent} from './agent-activity.js';
export const reviewedGatewayClientPath='/opt/homebrew/lib/node_modules/openclaw/dist/client-BT5GVyth.js';
type Client={start():void;stop():void;request(method:string,params:Record<string,unknown>):Promise<unknown>};
export type ReaderClientOptions={url:string;clientName:string;clientDisplayName:string;mode:string;role:string;scopes:string[];sharedStateMode:string;hostDeps:{logError:()=>void;logDebug:()=>void};onHelloOk:(hello:unknown)=>void;onClose:()=>void;onConnectError:()=>void;onEvent:(event:unknown)=>void};
type Options={clientModulePath?:string;clientFactory?:(options:ReaderClientOptions)=>Client;fullCoverage?:ActivityAgent[];describe?:(agent:ActivityAgent,key:string,run:string)=>unknown;now?:()=>number};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const agent=(v:unknown):v is ActivityAgent=>typeof v==='string'&&(activityAgents as readonly string[]).includes(v);
type Evidence={agent:ActivityAgent;key:string;run:string;ts:number;revision:number};
/** Official host-owned identity is used internally by GatewayClient. This module never
 * reads credentials, requests writes, or forwards source payloads to the projection. */
export async function createGatewayActivityReader<T extends object>(taskSnapshot:()=>Promise<T>|T,options:Options={}) {
 let factory=options.clientFactory;
 if(!factory){
  if(options.clientModulePath!==reviewedGatewayClientPath)throw Error('Reviewed Gateway client module required');
  try {const module=await import(options.clientModulePath);if(typeof module.GatewayClient!=='function')throw Error();factory=opts=>new module.GatewayClient(opts) as Client;}
  catch {throw Error('Reviewed Gateway client unavailable');}
 }
 const now=options.now??Date.now;const evidence=new Map<string,Evidence>();const terminal=new Map<string,number>();
 const messageSequences=new Map<string,number>();let connectedAt=0;
 let revision=0,generation=0,authorized=false,closed=false,client:Client|undefined,restart:ReturnType<typeof setTimeout>|undefined;
 const identity=(a:ActivityAgent,key:string,run:string)=>JSON.stringify([a,key,run]);
 const disconnected=()=>{authorized=false;generation++;evidence.clear();terminal.clear();messageSequences.clear();provider.disconnected();};
 const reconnect=()=>{disconnected();client?.stop();if(!closed&&!restart){restart=setTimeout(()=>{restart=undefined;if(!closed)client?.start();},1000);restart.unref();}};
 const provider=createLiveActivityProvider(taskSnapshot,{async request(method,params){
  if(!authorized||!client||closed)throw Error('Activity connection unavailable');
  const epoch=generation,requestRevision=revision;
  try {
   let timer:ReturnType<typeof setTimeout>|undefined;
   let result:unknown;try{result=await Promise.race([client.request(method,params),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Activity read timeout')),3500);})]);}finally{if(timer)clearTimeout(timer);}
   if(epoch!==generation||!authorized)throw Error('Activity connection changed');
   if(method==='sessions.list'&&object(result)&&Array.isArray(result.sessions))for(const row of result.sessions){
    if(!object(row)||!agent(row.agentId)||typeof row.key!=='string'||row.hasActiveRun!==false||row.agentId!==params.agentId)continue;
    for(const [id,item] of evidence)if(item.agent===row.agentId&&item.key===row.key&&item.revision<=requestRevision)evidence.delete(id);
   }
   return result;
  }catch(error){
   // A scoped denial is not a broken transport; other agents may remain observable.
   const denied=object(error)&&typeof error.code==='string'&&['MISSING_SCOPE','FORBIDDEN','UNAUTHORIZED','INVALID_REQUEST'].includes(error.code);
   if(epoch===generation&&!denied)reconnect();throw Error('Activity read unavailable');
  }
 }},{fullCoverage:options.fullCoverage,describe:options.describe,executionEvidence:(a,key)=>{
  if(!authorized)return [];return [...evidence.values()].filter(v=>v.agent===a&&v.key===key).map(v=>v.run);
 }});
 const onEvent=(frame:unknown)=>{
  if(!authorized||closed||!object(frame)||!object(frame.payload))return;
  if(frame.event==='session.message'){
   const p=frame.payload,m=p.message;if(!object(m)||!object(m.__openclaw))return;
   const meta=m.__openclaw;
   // Read execution metadata only. Never inspect content, tool arguments or output.
   if(!agent(p.agentId)||typeof p.sessionKey!=='string'||typeof meta.runId!=='string'||!meta.runId||meta.runId.length>200||!Number.isSafeInteger(meta.seq)||(meta.seq as number)<1)return;
   if(p.runId!==undefined&&p.runId!==meta.runId)return;
   for(const ts of [m.timestamp,meta.recordTimestampMs])if(typeof ts!=='number'||!Number.isSafeInteger(ts)||ts<connectedAt-2000||ts>now()+2000||now()-ts>60000)return;
   if(meta.mirrorOrigin!=='codex-app-server')return;
   const ending=m.role==='assistant'&&['stop','endTurn','error','aborted'].includes(String(m.stopReason));
   const executing=(m.role==='assistant'&&m.stopReason==='toolUse')||m.role==='toolResult';
   if(!ending&&(!executing||p.hasActiveRun!==true||p.status!=='running'))return;
   const id=identity(p.agentId,p.sessionKey,meta.runId),seq=meta.seq as number;
   if(seq<=(messageSequences.get(id)??0))return;
   messageSequences.set(id,seq);if(messageSequences.size>2000)messageSequences.delete(messageSequences.keys().next().value!);
   onEvent({event:'sessions.changed',payload:{agentId:p.agentId,sessionKey:p.sessionKey,runId:meta.runId,ts:meta.recordTimestampMs,phase:ending?'end':'start'}});
   return;
  }
  if(frame.event!=='session.tool'&&frame.event!=='sessions.changed')return;
  const p=frame.payload;
  if(!agent(p.agentId)||typeof p.sessionKey!=='string'||!p.sessionKey||p.sessionKey.length>500||typeof p.runId!=='string'||!p.runId||p.runId.length>200||typeof p.ts!=='number'||!Number.isSafeInteger(p.ts)||p.ts>now()+2000||now()-p.ts>60000)return;
  const keyAgent=/^agent:([^:]+):/.exec(p.sessionKey)?.[1];if(keyAgent&&keyAgent!==p.agentId)return;
  const id=identity(p.agentId,p.sessionKey,p.runId);const prior=evidence.get(id);
  if(frame.event==='sessions.changed'&&(p.phase==='end'||p.phase==='error')){
   if(prior&&p.ts<prior.ts)return;evidence.delete(id);terminal.set(id,p.ts);if(terminal.size>2000)terminal.delete(terminal.keys().next().value!);revision++;provider.changed();return;
  }
  const tool=frame.event==='session.tool'&&p.stream==='tool'&&object(p.data)&&['start','update','result'].includes(String(p.data.phase));
  if(!(tool||(frame.event==='sessions.changed'&&p.phase==='start')))return;
  if(terminal.has(id)||(prior&&p.ts<prior.ts))return;
  if(evidence.size>=2000&&!prior)return;
  evidence.set(id,{agent:p.agentId,key:p.sessionKey,run:p.runId,ts:p.ts,revision:++revision});provider.changed();
 };
 client=factory({url:'ws://127.0.0.1:18789',clientName:'gateway-client',clientDisplayName:'Engine Room activity reader',mode:'backend',role:'operator',scopes:['operator.read'],sharedStateMode:'read-only',hostDeps:{logError:()=>{},logDebug:()=>{}},
  onHelloOk:hello=>{
   disconnected();if(closed)return;
   if(!object(hello)||!object(hello.auth)||!Array.isArray(hello.auth.scopes)||hello.auth.scopes.length!==1||hello.auth.scopes[0]!=='operator.read'){client?.stop();return;}
   authorized=true;connectedAt=now();void provider.connected();
  },onClose:disconnected,onConnectError:disconnected,onEvent});
 return {start:()=>{if(!closed)client!.start();},snapshot:provider.snapshot,close:()=>{closed=true;if(restart)clearTimeout(restart);disconnected();provider.close();client?.stop();}};
}
