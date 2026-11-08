import {AgentActivitySource,type ActivityRpc,type ActivityAgent} from './agent-activity.js';
/** Opt-in composition for a supervisor-approved, already authenticated reader.
 * Never starts a Gateway connection, requests privileges, or changes the existing
 * snapshot service. The caller owns connection close/event wiring and disposal. */
export function createLiveActivityProvider<T extends object>(taskSnapshot:()=>Promise<T>|T,rpc:ActivityRpc,options:{fullCoverage?:ActivityAgent[];describe?:(agent:ActivityAgent,key:string,runId:string)=>unknown;executionEvidence?:(agent:ActivityAgent,key:string)=>readonly string[]}={}) {
 const activity=new AgentActivitySource(rpc,options);
 let stopped=false;
 const timer=setInterval(()=>{if(!stopped)void activity.refresh();},3000);timer.unref();
 return {
  connected:()=>activity.connect(),
  disconnected:()=>activity.disconnect(),
  // The reader should forward session-list/lifecycle invalidations, not transcripts.
  changed:()=>{activity.invalidate();void activity.refresh();},
  snapshot:async()=>({...await taskSnapshot(),activity:activity.snapshot()}),
  close:()=>{stopped=true;clearInterval(timer);activity.disconnect();},
 };
}
