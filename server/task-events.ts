import type Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import type { ParsedAgentEvent } from './gateway-client.js';

export type WorkState = 'queued' | 'running' | 'waiting' | 'review' | 'delivered' | 'unverified';
export interface Obstacle { reason: string; impact: string; waitingOn: string; nextOwner: string; recommendation: string; options: string[] }
export interface Evidence { label: string; url: string }
interface Row { task_id: string; goal_id: string | null; goal_title: string | null; project_id: string | null; project_title: string | null; occurrence_id: string | null; why_text: string; state: WorkState; run_id: string | null; producer: string | null; last_seq: number; observed_at: number | null; received_at: number | null; progress: string; next_action: string; obstacle_json: string | null; evidence_json: string | null; reviewer: string | null; delivered_at: number | null }
export interface LifecycleEvent { producer: string; id: string; kind: 'bind' | 'start' | 'progress' | 'end' | 'failed' | 'waiting' | 'review' | 'reject' | 'delivered' | 'reconcile'; observedAt: number; runId?: string; seq?: number; summary: string; nextAction: string; obstacle?: Obstacle; evidence?: Evidence[] }
function text(value: unknown, max = 2000): asserts value is string { if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error('Invalid text'); }
export function validEvidence(evidence: Evidence[] | undefined): evidence is Evidence[] {
 return Array.isArray(evidence) && evidence.length > 0 && evidence.length <= 20 && evidence.every(e => { try { text(e.label, 200); const u = new URL(e.url); return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash; } catch { return false; } });
}
function validateObstacle(o: Obstacle | undefined): asserts o is Obstacle {
 if (!o) throw new Error('An explained obstacle is required');
 for (const v of [o.reason,o.impact,o.waitingOn,o.nextOwner,o.recommendation]) text(v);
 if (!Array.isArray(o.options) || !o.options.length || o.options.length > 8) throw new Error('Options required');
 o.options.forEach(v => text(v));
}
export class TaskLifecycle {
 constructor(private db: Database.Database) {
  db.exec(readFileSync(new URL('./migrations/20261107_task_lifecycle.sql', import.meta.url), 'utf8'));
  const prior=db.prepare('SELECT state FROM task_lifecycle_source WHERE id=1').get() as {state:string};
  if(prior.state!=='unconfigured') this.setSourceStatus('disconnected','The task service restarted; missed execution updates need review.');
 }
 private flagTask(taskId:string, reason:string) {
  this.db.prepare(`INSERT OR IGNORE INTO task_lifecycle_reconciliation(task_id,reason,detected_at) SELECT task_id,?,? FROM task_lifecycle WHERE task_id=? AND state!='delivered'`).run(reason,Date.now(),taskId);
 }
 flagRun(runId:string, reason:string) {
  const row=this.db.prepare('SELECT task_id FROM task_lifecycle WHERE run_id=? AND producer=?').get(runId,'gateway') as {task_id:string}|undefined;
  if(row) this.flagTask(row.task_id,reason);
 }
 setSourceStatus(state:'unconfigured'|'connected'|'disconnected', reason?:string) {
  this.db.transaction(()=>{
   if(state!=='connected') {
    const tasks=this.db.prepare("SELECT task_id FROM task_lifecycle WHERE run_id IS NOT NULL AND state!='delivered'").all() as {task_id:string}[];
    for(const row of tasks) this.flagTask(row.task_id,reason??'Execution updates were interrupted; last-known task state needs review.');
   }
   this.db.prepare('UPDATE task_lifecycle_source SET state=?,observed_at=?,reason=? WHERE id=1').run(state,Date.now(),reason??(state==='connected'?'Gateway transport connected; task activity is verified separately.':'Execution updates are disconnected.'));
  })();
 }
 noteSourceActivity() {
  this.db.prepare("UPDATE task_lifecycle_source SET observed_at=? WHERE id=1 AND state='connected'").run(Date.now());
 }
 sourceHealth() {
  const source=this.db.prepare('SELECT state,observed_at AS observedAt,reason FROM task_lifecycle_source WHERE id=1').get() as {state:string;observedAt:number|null;reason:string};
  const count=(this.db.prepare('SELECT count(*) AS n FROM task_lifecycle_reconciliation').get() as {n:number}).n;
  return count?{...source,state:'reconciliation_required',reason:'Execution updates were interrupted or inconsistent. Mildred must reconcile affected tasks; reconnecting alone does not verify them.'}:source;
 }
 link(taskId: string, input: { goal?: {id:string;title:string}; project?: {id:string;title:string}; occurrenceId?: string; why: string; nextAction: string }) {
  text(taskId,200); text(input.why); text(input.nextAction);
  for (const ref of [input.goal,input.project]) if (ref) { text(ref.id,200); text(ref.title,300); }
  if (input.occurrenceId) text(input.occurrenceId,200);
  // Insert once: reassignment/link reconciliation must be explicit, never title matching.
  this.db.prepare(`INSERT INTO task_lifecycle(task_id,goal_id,goal_title,project_id,project_title,occurrence_id,why_text,progress,next_action) VALUES(?,?,?,?,?,?,?,?,?)`).run(taskId,input.goal?.id??null,input.goal?.title??null,input.project?.id??null,input.project?.title??null,input.occurrenceId??null,input.why,'Assigned — execution has not been verified.',input.nextAction);
 }
 ingest(taskId: string, event: LifecycleEvent, authority: 'supervisor' | 'gateway') {
  return this.db.transaction(() => {
   text(event.producer,200); text(event.id,300); text(event.summary); text(event.nextAction);
   if (!Number.isSafeInteger(event.observedAt) || event.observedAt < 0 || event.observedAt > Date.now()+5000) throw new Error('Invalid source time');
   const prior = this.db.prepare('SELECT task_id,observed_at,kind,summary FROM task_lifecycle_events WHERE producer=? AND event_id=?').get(event.producer,event.id) as {task_id:string;observed_at:number;kind:string;summary:string}|undefined;
   if (prior) {
    if (prior.task_id !== taskId) throw new Error('Event identity conflict');
    if(authority==='gateway' && (prior.observed_at!==event.observedAt || prior.kind!==event.kind || prior.summary!==event.summary)) {
     this.flagTask(taskId,'A run reused an event identity with changed source facts; automatic updates are paused.');return {reconciliationRequired:true};
    }
    return {duplicate:true};
   }
   const row = this.db.prepare('SELECT * FROM task_lifecycle WHERE task_id=?').get(taskId) as Row | undefined;
   if (!row) throw new Error('Task is not linked');
   if (row.state === 'delivered') { if(event.kind === 'delivered' && authority === 'supervisor') return {duplicate:true}; throw new Error('Delivered task is immutable; use a new occurrence'); }
   const needsReconciliation=Boolean(this.db.prepare('SELECT task_id FROM task_lifecycle_reconciliation WHERE task_id=?').get(taskId));
   const execution = ['start','progress','end','failed'].includes(event.kind);
   if(needsReconciliation && execution) return {reconciliationRequired:true};
   if(needsReconciliation && ['review','delivered'].includes(event.kind)) throw Error('Explicit reconciliation required');
   if (execution) {
    if (authority !== 'gateway' || !row.run_id || row.run_id !== event.runId || row.producer !== event.producer) throw new Error('Unbound execution');
    if (!Number.isSafeInteger(event.seq) || event.seq! < 0) throw new Error('Sequence required');
    if (event.seq! <= row.last_seq || event.observedAt < (row.observed_at ?? 0)) {
     this.flagTask(taskId,'Execution sequence or source time moved backwards; automatic updates are paused.');return {reconciliationRequired:true};
    }
    if(event.kind!=='start' && row.last_seq<0) {
     this.flagTask(taskId,'Execution activity arrived without a verified start; automatic updates are paused.');return {reconciliationRequired:true};
    }
    if(event.kind==='start' && row.last_seq>=0) {
     this.flagTask(taskId,'The bound run emitted a new start after prior execution; run identity must be reviewed.');return {reconciliationRequired:true};
    }
   } else if (authority !== 'supervisor') throw new Error('Supervisor required');
   let state: WorkState = row.state; let run = row.run_id, producer = row.producer, obstacle = row.obstacle_json, evidence = row.evidence_json;
   let reviewer = row.reviewer, delivered = row.delivered_at;
   switch(event.kind) {
    case 'reconcile':
     if(!needsReconciliation || !validEvidence(event.evidence)) throw Error('Reconciliation needs explicit evidence');
     this.db.prepare('DELETE FROM task_lifecycle_reconciliation WHERE task_id=?').run(taskId);
     state='waiting';evidence=JSON.stringify(event.evidence);
     obstacle=JSON.stringify({reason:'Execution history was reviewed after an interruption.',impact:'The result still requires explicit review and acceptance.',waitingOn:'Mildred',nextOwner:'Mildred',recommendation:'Review the evidence or assign a new task occurrence for another run.',options:['Submit the verified result for review','Create a new task occurrence']} satisfies Obstacle);
     break;
    case 'bind':
     if (row.run_id || !event.runId || row.state !== 'queued') throw new Error('Run binding conflict');
     text(event.runId,200); run=event.runId; producer=event.producer; break;
    case 'start':
     if (row.state !== 'queued') throw new Error('Execution already started');
     state='running'; break;
    case 'progress':
     if(row.state !== 'running') throw new Error('Execution not active'); break;
    case 'end':
     if(row.state !== 'running') throw new Error('Execution not active');
     state='waiting'; obstacle=JSON.stringify({reason:'The run ended without reviewed output.',impact:'Delivery is not verified.',waitingOn:'Mildred',nextOwner:'Mildred',recommendation:'Check the output and attach evidence for review.',options:['Review available output','Authorize another attempt']} satisfies Obstacle); break;
    case 'failed': case 'waiting': case 'reject':
     if(event.kind==='reject' && row.state!=='review') throw new Error('No review to reject');
     validateObstacle(event.obstacle); state='waiting'; obstacle=JSON.stringify(event.obstacle); break;
    case 'review':
     if(!row.run_id || row.last_seq < 0 || !['running','waiting'].includes(row.state) || !validEvidence(event.evidence)) throw new Error('Bound execution and safe evidence required');
     state='review'; evidence=JSON.stringify(event.evidence); obstacle=null; break;
    case 'delivered':
     if(row.state!=='review' || !evidence) throw new Error('Evidence and review required');
     state='delivered'; reviewer='Mildred'; delivered=event.observedAt; break;
    default: throw new Error('Unknown event');
   }
   const receivedAt=Date.now();
   this.db.prepare(`INSERT INTO task_lifecycle_events(task_id,producer,event_id,observed_at,received_at,kind,summary) VALUES(?,?,?,?,?,?,?)`).run(taskId,event.producer,event.id,event.observedAt,receivedAt,event.kind,event.summary);
   this.db.prepare(`UPDATE task_lifecycle SET state=?,run_id=?,producer=?,last_seq=?,observed_at=?,received_at=?,progress=?,next_action=?,obstacle_json=?,evidence_json=?,reviewer=?,delivered_at=? WHERE task_id=?`).run(state,run,producer,execution?event.seq:row.last_seq,Math.max(event.observedAt,row.observed_at??0),receivedAt,event.summary,event.nextAction,obstacle,evidence,reviewer,delivered,taskId);
   return {duplicate:false};
  })();
 }
 snapshot() {
  const rows=this.db.prepare('SELECT t.id,t.title,t.description,t.agent_id,t.status,l.* FROM tasks t LEFT JOIN task_lifecycle l ON l.task_id=t.id ORDER BY t.created_at DESC LIMIT 200').all() as (Row & {id:string;title:string;description:string;agent_id:string|null;status:string})[];
  return {version:1,checkedAt:Date.now(),sourceHealth:this.sourceHealth(),revision:(this.db.prepare('SELECT COALESCE(MAX(revision),0) n FROM task_lifecycle_events').get() as {n:number}).n,tasks:rows.map(r=>({
   id:r.id,reconciliationNeeded:Boolean(this.db.prepare('SELECT task_id FROM task_lifecycle_reconciliation WHERE task_id=?').get(r.id)),reconciliationReason:(this.db.prepare('SELECT reason FROM task_lifecycle_reconciliation WHERE task_id=?').get(r.id) as {reason:string}|undefined)?.reason??null,title:r.title,owner:r.agent_id??'Unassigned',goal:r.goal_id?{id:r.goal_id,title:r.goal_title}:null,project:r.project_id?{id:r.project_id,title:r.project_title}:null,occurrenceId:r.occurrence_id??null,
   why:r.why_text??r.description??'Purpose not recorded',state:r.state??(['ready','backlog'].includes(r.status)?'queued':'unverified'),progress:r.progress??(r.status==='complete'?'Completion reported — not yet verified.':'Execution has not been verified.'),nextAction:r.next_action??'Mildred to reconcile the task record.',observedAt:r.observed_at??null,receivedAt:r.received_at??null,source:r.task_id?'Task lifecycle record':'Legacy task record',
   obstacle:r.obstacle_json?JSON.parse(r.obstacle_json):null,evidence:r.evidence_json?JSON.parse(r.evidence_json):[],reviewer:r.reviewer??null,deliveredAt:r.delivered_at??null,
   history:this.db.prepare('SELECT * FROM (SELECT revision,kind,summary,observed_at AS observedAt,received_at AS receivedAt FROM task_lifecycle_events WHERE task_id=? ORDER BY revision DESC LIMIT 100) ORDER BY revision').all(r.id)
  }))};
 }
}

// Only allowlisted execution facts cross into the public task projection.
// Raw tool output, errors, session identities and assistant text stay private.
export function lifecycleEventFromGateway(parsed: ParsedAgentEvent): LifecycleEvent | null {
 const kind = parsed.stream === 'lifecycle' && parsed.phase === 'start' ? 'start'
  : parsed.stream === 'lifecycle' && parsed.phase === 'end' ? 'end'
  : parsed.stream === 'lifecycle' && parsed.phase === 'error' ? 'failed'
  : parsed.stream === 'error' ? 'failed'
  : ['tool', 'assistant'].includes(parsed.stream) ? 'progress' : null;
 // Gateway sequence-gap notices lack seq; they cannot be represented as run
 // failures or invented ordered execution. Reconciliation is a separate concern.
 if (!kind || !Number.isSafeInteger(parsed.seq) || parsed.seq < 0 || !Number.isSafeInteger(parsed.observedAt) || !parsed.runId) return null;
 return {producer:'gateway',id:`${parsed.runId}:${parsed.seq}`,runId:parsed.runId,seq:parsed.seq,observedAt:parsed.observedAt,kind,
  summary:kind==='start'?'Execution started.':kind==='end'?'Execution ended; output needs review.':kind==='failed'?'Execution reported a failure.':'Execution activity verified.',
  nextAction:'Mildred to supervise the result.',
  ...(kind==='failed'?{obstacle:{reason:'Execution reported a failure.',impact:'The result is not delivered.',waitingOn:'Mildred',nextOwner:'Mildred',recommendation:'Inspect private execution evidence before retrying.',options:['Diagnose the failure','Authorize a retry']}}:{})};
}
