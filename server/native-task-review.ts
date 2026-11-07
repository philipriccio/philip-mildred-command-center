import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { closeSync, openSync, lstatSync } from 'node:fs';
import { basename, isAbsolute } from 'node:path';
import { validEvidence, type Evidence } from './task-events.js';

/** Explicit native facts; never pass notification timestamps or delivery status.
 * ownerSession + taskId scope identity; all remaining fields bind execution facts.
 */
export interface NativeReviewTask {
  ownerSession: string; taskId: string; runtime: 'subagent' | 'acp'; agentId: string | null;
  status: string; terminalOutcome: string | null;
  createdAt: number; startedAt: number | null; endedAt: number | null;
}
export interface NativeTaskAcceptance {
  lifecycleFingerprint: string; reviewer: string; summary: string; nextAction: string;
  evidence: Evidence[]; acceptedAt: number;
}
export type NativeTaskAcceptanceInput = Omit<NativeTaskAcceptance, 'acceptedAt'>;
const table = 'native_task_acceptances';
const schema = `CREATE TABLE ${table} (
 owner_session TEXT NOT NULL, task_id TEXT NOT NULL, lifecycle_fingerprint TEXT NOT NULL,
 reviewer TEXT NOT NULL, summary TEXT NOT NULL, next_action TEXT NOT NULL,
 evidence_json TEXT NOT NULL, accepted_at INTEGER NOT NULL,
 PRIMARY KEY(owner_session,task_id)
);
CREATE TRIGGER native_review_no_update BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT,'Acceptance is immutable'); END;
CREATE TRIGGER native_review_no_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT,'Acceptance is immutable'); END;
PRAGMA user_version = 1;`;
function text(value: unknown, max = 2000): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f\x7f]/.test(value)) throw Error('Invalid review text');
}
function validateTask(t: NativeReviewTask) {
  text(t.ownerSession,300); text(t.taskId,200);
  if (!t.ownerSession.startsWith('agent:main:') || !t.ownerSession.slice(11).trim()) throw Error('Explicit main-owned scope required');
  if (!['subagent','acp'].includes(t.runtime)) throw Error('Invalid native runtime');
  if (t.agentId !== null) text(t.agentId,200);
  if (t.terminalOutcome !== null) text(t.terminalOutcome,200);
  if (!['succeeded','failed','timed_out','cancelled','lost'].includes(t.status)) throw Error('Terminal task required');
  for (const value of [t.createdAt,t.startedAt,t.endedAt]) {
    if (value !== null && (!Number.isSafeInteger(value) || value < 0 || value > Date.now()+5000)) throw Error('Invalid lifecycle time');
  }
  if (t.endedAt === null || !Number.isSafeInteger(t.createdAt) || t.createdAt <= 0 ||
      t.endedAt < t.createdAt || (t.startedAt !== null && (t.startedAt < t.createdAt || t.startedAt > t.endedAt)) ||
      (t.status === 'succeeded' && t.startedAt === null)) throw Error('Contradictory lifecycle');
}
/** Stable SHA-256 of allowlisted lifecycle facts, including scope, excluding notification bookkeeping. */
export function nativeTaskLifecycleFingerprint(task: NativeReviewTask): string {
  validateTask(task);
  return createHash('sha256').update(JSON.stringify([1,task.ownerSession,task.taskId,task.runtime,task.agentId,
    task.status,task.terminalOutcome,task.createdAt,task.startedAt,task.endedAt])).digest('hex');
}
function validateAcceptance(input: NativeTaskAcceptanceInput) {
  if (!/^[a-f0-9]{64}$/.test(input.lifecycleFingerprint)) throw Error('Invalid lifecycle fingerprint');
  text(input.reviewer,200); text(input.summary); text(input.nextAction);
  if (!validEvidence(input.evidence) || input.evidence.some(e => typeof e.url !== 'string' || e.url.length > 2048) ||
      new Set(input.evidence.map(e => new URL(e.url).href)).size !== input.evidence.length) throw Error('Bounded, distinct safe evidence required');
}
function validatePath(path: string) {
  // A dedicated basename plus exclusive initialization prevents accidental registry/legacy DB migration.
  if (!isAbsolute(path) || basename(path) !== 'native-task-reviews.sqlite') throw Error('Dedicated absolute native-task-reviews.sqlite path required');
  if (lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile()) throw Error('Ledger must be a regular file');
}
function verifySchema(db: Database.Database) {
  const names = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {name:string}[]).map(r=>r.name);
  if (db.pragma('user_version',{simple:true}) !== 1 || names.length !== 1 || names[0] !== table) throw Error('Not a dedicated native review ledger');
  for (const name of ['native_review_no_update','native_review_no_delete']) {
    if (!db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name=?").get(name)) throw Error('Immutable ledger guards missing');
  }
}
function openReader(path: string) {
  validatePath(path);
  const db = new Database(path,{readonly:true,fileMustExist:true});
  try { db.pragma('query_only = ON'); db.pragma('busy_timeout = 1000'); verifySchema(db); return db; }
  catch (error) { db.close(); throw error; }
}
/** Local supervisor setup only. Exclusive creation: refuses any existing file; no migrations or native DB access. */
export function initializeNativeTaskReviewLedger(path: string): void {
  if (!isAbsolute(path) || basename(path) !== 'native-task-reviews.sqlite') throw Error('Dedicated absolute native-task-reviews.sqlite path required');
  closeSync(openSync(path,'wx',0o600));
  const db = new Database(path,{fileMustExist:true});
  try { db.transaction(()=>db.exec(schema)).immediate(); } finally { db.close(); }
}
/** Local trusted supervisor call ONLY; do not expose through HTTP or notification handlers.
 * Caller must supply freshly read native facts and the fingerprint explicitly reviewed.
 * Accepts an outcome (including failure), never asserts execution succeeded.
 */
export function acceptNativeTask(path: string, task: NativeReviewTask, input: NativeTaskAcceptanceInput): NativeTaskAcceptance {
  const fingerprint = nativeTaskLifecycleFingerprint(task); validateAcceptance(input);
  if (fingerprint !== input.lifecycleFingerprint) throw Error('Lifecycle fingerprint mismatch');
  const reader = openReader(path); reader.close();
  const db = new Database(path,{fileMustExist:true});
  try {
    db.pragma('busy_timeout = 1000');
    return db.transaction(()=>{
      verifySchema(db);
      if (db.prepare(`SELECT 1 FROM ${table} WHERE owner_session=? AND task_id=?`).get(task.ownerSession,task.taskId)) throw Error('Duplicate or contradictory acceptance');
      const acceptedAt = Date.now();
      if (task.endedAt! > acceptedAt) throw Error('Task end is in the future');
      db.prepare(`INSERT INTO ${table} VALUES(?,?,?,?,?,?,?,?)`).run(task.ownerSession,task.taskId,fingerprint,input.reviewer,input.summary,input.nextAction,JSON.stringify(input.evidence),acceptedAt);
      return {...input,evidence:input.evidence.map(e=>({...e})),acceptedAt};
    }).immediate();
  } finally { db.close(); }
}
/** Read-only snapshot capability: private connection, no writer/SQL escape hatch.
 * null masks absent, stale or malformed acceptance; storage failures throw so source health can fail closed.
 * Native facts must be supplied afresh for every projection. Missing ledger is an explicit open failure.
 */
export function openNativeTaskReviewProjection(path: string): Readonly<{
  read(task: NativeReviewTask): NativeTaskAcceptance | null; close(): void;
}> {
  const db = openReader(path);
  return Object.freeze({
    read(task: NativeReviewTask): NativeTaskAcceptance | null {
      let fingerprint: string;
      try { fingerprint = nativeTaskLifecycleFingerprint(task); } catch { return null; }
      const rows = db.prepare(`SELECT lifecycle_fingerprint AS lifecycleFingerprint,reviewer,summary,next_action AS nextAction,
        evidence_json AS evidenceJson,accepted_at AS acceptedAt FROM ${table} WHERE owner_session=? AND task_id=? LIMIT 2`).all(task.ownerSession,task.taskId) as (Omit<NativeTaskAcceptance,'evidence'> & {evidenceJson:string})[];
      if (rows.length !== 1 || rows[0].lifecycleFingerprint !== fingerprint) return null;
      try {
        const {evidenceJson,...row}=rows[0]; const result={...row,evidence:JSON.parse(evidenceJson)};
        validateAcceptance(result);
        if (!Number.isSafeInteger(result.acceptedAt) || result.acceptedAt < task.endedAt! || result.acceptedAt > Date.now()+5000) return null;
        return result;
      } catch { return null; }
    },
    close(){db.close();},
  });
}
