import Database from 'better-sqlite3';
import { openNativeTaskReviewProjection, nativeTaskLifecycleFingerprint, type NativeReviewTask } from './native-task-review.js';

type Readiness = { ready: boolean; checkedAt: number; bootAt: number | null };
type NativeRow = { task_id:string; runtime:string; agent_id:string|null; label:string|null; status:string; terminal_outcome:string|null; created_at:number; started_at:number|null; ended_at:number|null; last_event_at:number|null };
export async function probeLocalGateway():Promise<Readiness> {
  const checkedAt=Date.now();
  try {
    const response=await fetch('http://127.0.0.1:18789/readyz',{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(1500)});
    if(!response.ok)throw Error('Unavailable');
    const reader=response.body?.getReader();if(!reader)throw Error('Unavailable');
    let size=0;const chunks:Uint8Array[]=[];
    try {while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>8192){await reader.cancel();throw Error('Oversized');}chunks.push(part.value);}}
    finally {reader.releaseLock();}
    const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(value.ready!==true||!Number.isSafeInteger(value.uptimeMs)||value.uptimeMs<0)throw Error('Unavailable');
    return {ready:true,checkedAt,bootAt:checkedAt-value.uptimeMs};
  }catch{return {ready:false,checkedAt,bootAt:null};}
}

/** Reads only this explicitly configured main-owned conversation's task metadata.
 * Never opens transcripts, prompts, errors, tool output, delivery payloads or
 * other agents' session stores. Native notification delivery is NOT acceptance.
 */
export class NativeTaskSource {
  private db:Database.Database;
  private reviews:ReturnType<typeof openNativeTaskReviewProjection>|null=null;
  constructor(path:string,private ownerSession:string,private since:number,private probe:()=>Promise<Readiness>=probeLocalGateway,reviewLedgerPath?:string) {
    if(!ownerSession.startsWith('agent:main:')||ownerSession.length>300||!ownerSession.slice(11).trim())throw Error('Explicit main-owned session scope required');
    if(!Number.isSafeInteger(since)||since<=0||since>Date.now()+5000)throw Error('Explicit native adoption time required');
    this.db=new Database(path,{readonly:true,fileMustExist:true});
    try {
      this.db.pragma('query_only = ON');this.db.pragma('busy_timeout = 1000');
      // Read-only optional ledger; never initialize or migrate it at service startup.
      if(reviewLedgerPath!==undefined)this.reviews=openNativeTaskReviewProjection(reviewLedgerPath);
    } catch(error) {this.db.close();throw error;}
  }
  close(){try{this.reviews?.close();}finally{this.db.close();}}
  async snapshot(){
    const health=await this.probe(),now=Date.now();
    const rows=this.db.prepare(`SELECT task_id,runtime,agent_id,label,status,terminal_outcome,
      created_at,started_at,ended_at,last_event_at FROM task_runs
      WHERE owner_key=? AND requester_agent_id='main' AND scope_kind='session'
      AND runtime IN ('subagent','acp') AND created_at>=?
      ORDER BY created_at DESC,task_id DESC LIMIT 200`).all(this.ownerSession,this.since) as NativeRow[];
    const tasks=rows.map(r=>{
      const observedAt=r.ended_at??r.started_at??r.created_at;
      const registryAt=r.last_event_at??observedAt;
      for(const value of [r.created_at,r.started_at,r.ended_at,r.last_event_at])if(value!==null&&(!Number.isSafeInteger(value)||value<0||value>now+5000))throw Error('Invalid native task timestamp');
      // last_event_at includes notification bookkeeping, not just execution activity.
      const activityAt=r.started_at??r.created_at;
      const stale=!health.ready||activityAt<now-60000||(health.bootAt!==null&&activityAt<health.bootAt);
      let state='unverified',progress='Native task state needs checking.',reason='The task source does not establish current execution.';
      const coherent=r.started_at===null||r.started_at>=r.created_at;
      const activeCoherent=coherent&&r.ended_at===null&&registryAt>=(r.started_at??r.created_at);
      if(r.status==='queued'&&r.started_at===null&&activeCoherent&&!stale){state='queued';progress='Assigned; execution has not started.';}
      if(r.status==='running'&&r.started_at!==null&&activeCoherent){progress='Execution started; current activity needs verification.';reason='The registry records a start but supplies no execution-only heartbeat. Notification updates cannot verify continued work.';}
      if(['queued','running'].includes(r.status)&&stale){reason='No recent assignment/start evidence is available, or gateway readiness or continuity is not verified.';}
      const terminal=['succeeded','failed','timed_out','cancelled','lost'].includes(r.status);
      const facts:NativeReviewTask={ownerSession:this.ownerSession,taskId:r.task_id,runtime:r.runtime as NativeReviewTask['runtime'],agentId:r.agent_id,
        status:r.status,terminalOutcome:r.terminal_outcome,createdAt:r.created_at,startedAt:r.started_at,endedAt:r.ended_at};
      let terminalCoherent=false;
      if(terminal){try{nativeTaskLifecycleFingerprint(facts);terminalCoherent=true;}catch{reason='The terminal record has contradictory or incomplete lifecycle evidence.';progress=reason;}}
      if(terminalCoherent){
        state='waiting';
        reason=r.status==='succeeded'?(r.terminal_outcome==='blocked'?'The agent reported a blocker.':r.terminal_outcome!==null&&r.terminal_outcome!=='succeeded'?'The reported terminal outcome needs verification.':'The agent finished; Mildred has not accepted this result in the dashboard.'):
          r.status==='failed'?'The run failed.':r.status==='timed_out'?'The run timed out.':r.status==='cancelled'?'The run was cancelled.':'The run could no longer be tracked.';
        progress=reason;
      }
      const nativeProgress=progress;
      // Read errors propagate: projection HTTP returns 503 rather than silently losing acceptance.
      const review=terminalCoherent?this.reviews?.read(facts)??null:null;
      const accepted=review?.reviewer==='Mildred'?review:null;
      const successful=r.status==='succeeded'&&(r.terminal_outcome===null||r.terminal_outcome==='succeeded');
      if(accepted){
        if(successful){state='delivered';progress=accepted.summary;}
        else{progress=`${nativeProgress} Reviewed by Mildred. ${accepted.summary}`.slice(0,2000);}
      }
      const obstacle=['waiting','unverified'].includes(state)?{reason,impact:accepted?'The outcome was reviewed; successful completion is not established.':'Completion is not verified.',waitingOn:'Mildred',nextOwner:'Mildred',recommendation:accepted?.nextAction??'Inspect the run and its evidence before accepting or retrying.',options:['Review the result','Record the next action']}:null;
      return {id:`native:${r.task_id}`,title:r.label?.trim().slice(0,500)||'Agent task',owner:r.agent_id??'Unassigned',goal:null,project:null,occurrenceId:null,
        why:'Work assigned from this conversation; full purpose remains in the original brief.',state,progress,nextAction:accepted?.nextAction??(state==='running'?'Mildred to supervise execution.':state==='queued'?'Observe execution start.':'Mildred to review and record the outcome.'),
        observedAt,receivedAt:observedAt,source:'OpenClaw native task registry',obstacle,evidence:accepted?.evidence??[],reviewer:accepted?.reviewer??null,deliveredAt:state==='delivered'?accepted!.acceptedAt:null,
        history:[{revision:observedAt,kind:`native_${r.status}`,summary:nativeProgress,observedAt,receivedAt:observedAt},
          ...(accepted?[{revision:accepted.acceptedAt,kind:state==='delivered'?'delivered':'outcome_reviewed',summary:accepted.summary,observedAt:accepted.acceptedAt,receivedAt:accepted.acceptedAt}]:[])],reconciliationNeeded:false,reconciliationReason:null};
    });
    return {version:1,checkedAt:now,revision:now,tasks,sourceHealth:{state:health.ready?'connected':'disconnected',observedAt:health.checkedAt,
      reason:health.ready?'Native task registry and local gateway readiness verified. Scope: latest 200 delegated tasks in this conversation since adoption; acceptance is separate.':'Native records are available, but gateway readiness is not verified.'}};
  }
}
