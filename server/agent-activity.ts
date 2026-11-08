/** Read-only Gateway projection. No credentials, transcripts or raw labels cross this boundary. */
export const activityAgents = ['main','dev','janet'] as const;
export type ActivityAgent = typeof activityAgents[number];
export type ActivitySnapshot = {version:1;state:'connected'|'disconnected'|'reconciling';observedAt:number|null;agents:{id:ActivityAgent;status:'working'|'idle'|'unknown'|'disconnected';jobs:string[];observedAt:number|null;scope:'visible sessions'}[]};
export interface ActivityRpc { request(method:'sessions.subscribe'|'sessions.list',params:Record<string,unknown>):Promise<unknown> }
type Row={key:string;agentId:ActivityAgent;state:'working'|'inactive'|'unknown';canCorroborate:boolean;activeRunIds:string[]};
const isObject=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
/** Deliberately accepts only curated display metadata, never session title/message text. */
export function safeJobDescription(value:unknown,fallback='Working on a request; a clear task description is not available yet.'):string {
 if(typeof value!=='string'||value.length>160||value.length<8||/[\r\n\x00-\x1f<>`{}\\/]|https?:|@|token|password|secret|bearer|api[_ -]?key|[a-f0-9]{24}/i.test(value))return fallback;
 return value.trim();
}
/** A complete RPC response is not proof of permission to observe all work. fullCoverage
 * must be supplied only after supervisor verification of the reader's actual scope. */
export class AgentActivitySource {
 private generation=0; private observedAt:number|null=null; private state:ActivitySnapshot['state']='disconnected';
 private rows:Row[]=[]; private verifiedAgents=new Set<ActivityAgent>(); private fullCoverage:Set<ActivityAgent>; private pending:Promise<void>|null=null;
 constructor(private rpc:ActivityRpc, options:{fullCoverage?:ActivityAgent[];describe?:(agent:ActivityAgent,key:string,runId:string)=>unknown;executionEvidence?:(agent:ActivityAgent,key:string)=>readonly string[];now?:()=>number;staleMs?:number}={}) {
  this.executionEvidence=options.executionEvidence??(()=>[]);this.fullCoverage=new Set(options.fullCoverage??[]);this.describe=options.describe??(()=>undefined);this.now=options.now??Date.now;this.staleMs=options.staleMs??15000;
 }
 /** Reader-owned current-connection execution IDs; clear on terminal, disconnect,
  * reconnect and fresh inactive snapshots. Never bootstrap from historical events. */
 private executionEvidence:(agent:ActivityAgent,key:string)=>readonly string[];
 private describe:(agent:ActivityAgent,key:string,runId:string)=>unknown;private now:()=>number;private staleMs:number;
 private async request(method:'sessions.subscribe'|'sessions.list',params:Record<string,unknown>):Promise<unknown>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([this.rpc.request(method,params),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Activity read timed out')),4000);})]);}
  finally{if(timer)clearTimeout(timer);}
 }
 disconnect(){this.generation++;this.state='disconnected';this.rows=[];}
 /** Call once per successful authorized Gateway connection; late old RPCs cannot revive it. */
 async connect(){this.generation++;this.state='reconciling';this.rows=[];const generation=this.generation;
  try {const subscribed=await this.request('sessions.subscribe',{});if(!isObject(subscribed)||subscribed.subscribed!==true)throw Error('Subscription unavailable');if(generation!==this.generation)return;await this.refresh();}
  catch {if(generation===this.generation)this.disconnect();}
 }
 /** An event is only a refresh trigger. Never derive Idle from an end event, or Working
  * from a generic registry update. Invalidate pending scans if events race their snapshot. */
 invalidate(){if(this.state==='disconnected')return;this.generation++;this.state='reconciling';}
 async refresh():Promise<void>{
  if(this.state==='disconnected')return;
  if(this.pending){await this.pending;return;}
  const generation=this.generation;
  this.pending=(async()=>{try {
   const batches=await Promise.allSettled(activityAgents.map(async agent=>{
    const result=await this.request('sessions.list',{agentId:agent,limit:1000,includeGlobal:true,includeUnknown:true,includeDerivedTitles:false,includeLastMessage:false});
    if(!isObject(result)||!Array.isArray(result.sessions)||result.sessions.length>1000||result.hasMore!==false||result.count!==result.sessions.length||result.totalCount!==result.sessions.length)throw Error('Incomplete activity scope');
    const keys=new Set<string>();return result.sessions.map(value=>{
     if(!isObject(value)||typeof value.key!=='string'||!value.key||value.agentId!==agent||keys.has(value.key)||typeof value.hasActiveRun!=='boolean')throw Error('Unverified identity or activity');keys.add(value.key);
     const keyAgent=/^agent:([^:]+):/.exec(value.key)?.[1];if(keyAgent&&keyAgent!==agent)throw Error('Conflicting identity');
     const ids=value.activeRunIds;
     if(ids!==undefined&&(!Array.isArray(ids)||ids.length>100||ids.some(id=>typeof id!=='string'||!id||id.length>200)||new Set(ids).size!==ids.length||value.hasActiveRun!==(ids.length>0)))throw Error('Unverified active runs');
     // sessions.list can omit IDs for projected/embedded execution. Crucially, its
     // embedded queued shape is also {hasActiveRun:true,status:'running'} without
     // IDs. Do not invent a run ID or treat that ambiguous shape as execution.
     // Historical status can remain "running" after active=false; trust the fresh
     // explicit inactive flag, subject to the complete/authorized scope gates.
     const state:Row['state']=!value.hasActiveRun?'inactive':Array.isArray(ids)&&value.status==='running'?'working':'unknown';
     return {key:value.key,agentId:agent,state,canCorroborate:value.hasActiveRun&&value.status==='running'&&ids===undefined,activeRunIds:Array.isArray(ids)?ids as string[]:[]};
    });
   }));
   if(generation!==this.generation)return;this.rows=batches.flatMap(batch=>batch.status==='fulfilled'?batch.value:[]);this.verifiedAgents=new Set(activityAgents.filter((_,i)=>batches[i].status==='fulfilled'));this.observedAt=this.now();this.state=this.verifiedAgents.size?'connected':'reconciling';
  }catch{if(generation===this.generation){this.state='reconciling';this.rows=[];}}finally{this.pending=null;}})();await this.pending;
 }
 snapshot():ActivitySnapshot {
  const state=this.state==='connected'&&(this.observedAt===null||this.now()-this.observedAt>this.staleMs)?'disconnected':this.state;
  return {version:1,state,observedAt:this.observedAt,agents:activityAgents.map(id=>{
   const agentRows=this.rows.filter(row=>row.agentId===id);
   const active=agentRows.flatMap(row=>{
    if(row.state==='working')return [row];
    if(state!=='connected'||!row.canCorroborate)return [];
    try {
     const ids=this.executionEvidence(id,row.key);
     if(!Array.isArray(ids)||!ids.length||ids.length>100||ids.some(run=>typeof run!=='string'||!run||run.length>200)||new Set(ids).size!==ids.length)return [];
     return [{...row,activeRunIds:ids}];
    }catch{return [];}
   });
   const allJobs=state==='connected'?active.flatMap(row=>row.activeRunIds.map(run=>{try{return safeJobDescription(this.describe(id,row.key,run));}catch{return safeJobDescription(undefined);}})):[];
   const jobs=allJobs.length>100?[...allJobs.slice(0,99),'Also working on additional requests.']:allJobs;
   return {id,status:state==='disconnected'?'disconnected':state!=='connected'||!this.verifiedAgents.has(id)?'unknown':jobs.length?'working':agentRows.some(row=>row.state==='unknown')?'unknown':this.fullCoverage.has(id)?'idle':'unknown',jobs,observedAt:this.observedAt,scope:'visible sessions'};
  })};
 }
}
