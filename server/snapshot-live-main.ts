import {readFileSync,statSync} from 'node:fs';
import {createProjectionServer} from './snapshot-server.js';
import {NativeTaskSource} from './native-task-source.js';
import {createGatewayActivityReader,reviewedGatewayClientPath} from './gateway-activity-reader.js';

// Standalone replacement for the task-only service. Gateway authority is resolved
// inside the official read-only client; no Gateway credential enters this process's API.
const nativePath=process.env.MISSION_CONTROL_NATIVE_STATE_PATH;
const ownerSession=process.env.MISSION_CONTROL_OWNER_SESSION;
const token=process.env.COMMAND_CENTER_SNAPSHOT_TOKEN;
const port=Number(process.env.MISSION_CONTROL_SNAPSHOT_PORT??'3011');
if(!nativePath||!ownerSession||!token||!Number.isInteger(port)||port<1024||port>65535)throw Error('Snapshot configuration incomplete');
const source=new NativeTaskSource(nativePath,ownerSession,Number(process.env.MISSION_CONTROL_NATIVE_SINCE),undefined,process.env.MISSION_CONTROL_NATIVE_REVIEW_PATH);
const descriptions=process.env.MISSION_CONTROL_ACTIVITY_JOBS_PATH??'/Users/mildred/.openclaw/workfeed/activity-jobs.json';
const reader=await createGatewayActivityReader(()=>source.snapshot(),{
 clientModulePath:reviewedGatewayClientPath,
 // Verified November 7 using this exact read-only identity: untruncated lists for
 // all three agents. Projection explicitly says visible sessions, not all runtimes.
 fullCoverage:['main','dev','janet'],
 describe:(agent,key,run)=>{
  try {
   if(statSync(descriptions).size>65536)return undefined;
   const entries:unknown=JSON.parse(readFileSync(descriptions,'utf8'));
   if(!Array.isArray(entries))return undefined;
   return entries.find(e=>e&&e.agent===agent&&e.session===key&&e.run===run&&Number.isSafeInteger(e.expiresAt)&&e.expiresAt>Date.now())?.description;
  }catch{return undefined;}
 },
});
const server=createProjectionServer(token,reader.snapshot);
reader.start();server.listen(port,'127.0.0.1');
server.on('listening',()=>console.info('Read-only task and activity projection listening on loopback'));
server.on('error',()=>{reader.close();source.close();console.error('Work projection could not start');process.exitCode=1;});
for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>{
 reader.close();server.close(()=>{source.close();process.exit(0);});
 setTimeout(()=>process.exit(1),5000).unref();
});
