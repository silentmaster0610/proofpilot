import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {mkdir,rm} from 'node:fs/promises';
import {resolve,relative,isAbsolute} from 'node:path';
import {createServer} from 'node:net';
const port=await new Promise(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const base=`http://127.0.0.1:${port}`,ownerKey=randomBytes(32).toString('hex');
const stateDir=resolve('.test-state',crypto.randomUUID());
await mkdir(stateDir,{recursive:true});
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env:{...process.env,APP_URL:base,DATABASE_PATH:resolve(stateDir,'qa.sqlite'),TURSO_DATABASE_URL:'',TURSO_AUTH_TOKEN:'',REQUIRE_REMOTE_DB:'false',NEBIUS_API_KEY:'',PROOFPILOT_OWNER_KEY:ownerKey,PROOFPILOT_JUDGE_KEY:'',FOLLOWUP_SCANNER:'false',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
let logs='';server.stdout.on('data',c=>logs+=c);server.stderr.on('data',c=>logs+=c);
let ownerCookie='',guestCookie='';
async function req(path,body,cookie=ownerCookie,options={}){
  const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie,...options.headers},...(body===undefined?{}:{body:JSON.stringify(body)}),...options,signal:AbortSignal.timeout(15000)});
  return {r,data:await r.json()};
}
const post=payload=>req('/api/workspace',payload);
test('Render server: sessions, evidence and approvals',async t=>{
  t.after(async()=>{if(server.exitCode===null){const exited=new Promise(r=>server.once('exit',r));server.kill();await exited;}const child=relative(resolve('.test-state'),stateDir);assert.ok(child&&!child.startsWith('..')&&!isAbsolute(child));await rm(stateDir,{recursive:true,force:true});});
  let started=false;
  for(let i=0;i<60;i++){try{const r=await fetch(base+'/api/health');if(r.ok){started=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}
  assert.ok(started,'Server did not become healthy: '+logs.slice(-3000));
  await t.test('anonymous and forged Sites headers cannot access private data',async()=>{
    assert.equal((await req('/api/workspace',undefined,'')).r.status,401);
    assert.equal((await req('/api/workspace',undefined,'',{headers:{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.test'}})).r.status,401);
  });
  await t.test('invalid credentials and cross-origin login fail',async()=>{
    assert.equal((await req('/api/session',null,'')).r.status,400);
    assert.equal((await req('/api/session',{key:'wrong'},'')).r.status,401);
    assert.equal((await req('/api/session',{key:ownerKey},'',{headers:{Origin:'https://wrong.example'}})).r.status,403);
  });
  await t.test('owner signs in with HttpOnly secure session',async()=>{
    const {r}=await req('/api/session',{key:ownerKey},'');assert.equal(r.status,200);
    const c=r.headers.get('set-cookie');assert.match(c,/HttpOnly/i);assert.match(c,/Secure/i);assert.match(c,/SameSite=strict/i);ownerCookie=c.split(';')[0];
  });
  let w,taskId;
  await t.test('sample seed is idempotent and persists',async()=>{
    w=(await post({action:'seed'})).data.workspace;taskId=w.tasks[0].id;
    assert.equal((await post({action:'seed'})).data.workspace.tasks.length,1);
    assert.equal((await req('/api/workspace')).data.workspace.tasks[0].id,taskId);
  });
  await t.test('unprepared draft cannot be approved',async()=>assert.equal((await post({action:'task_approve',taskId,approvalHash:'fake'})).r.status,400));
  await t.test('sample generates verified evidence and awaits approval',async()=>{
    const {r,data}=await post({action:'task_run',taskId});assert.equal(r.status,200);w=data.workspace;
    assert.equal(w.tasks[0].status,'awaiting_approval');assert.equal(w.tasks[0].inference,undefined);
    for(const f of w.tasks[0].plan.facts)assert.ok(w.documents.find(d=>d.id===f.documentId).text.includes(f.quote));
  });
  await t.test('editing invalidates stale approval',async()=>{
    const previous=w.tasks[0].approvalHash;
    await post({action:'task_edit',taskId,subject:'My updated claim',body:w.tasks[0].plan.body+'\nPlease respond by email.'});
    assert.equal((await post({action:'task_approve',taskId,approvalHash:previous})).r.status,400);
  });
  await t.test('duplicate approval produces one receipt and reminder',async()=>{
    w=(await req('/api/workspace')).data.workspace;
    const input={action:'task_approve',taskId,approvalHash:w.tasks[0].approvalHash};
    assert.equal((await post(input)).r.status,200);assert.equal((await post(input)).r.status,200);
    w=(await req('/api/workspace')).data.workspace;assert.equal(w.receipts.length,1);assert.equal(w.reminders.length,1);assert.equal(w.receipts[0].contentSha256.length,64);
  });
  await t.test('guest workspace is isolated and cannot use live AI or add private documents',async()=>{
    const {r}=await req('/api/session',{demo:true},'');guestCookie=r.headers.get('set-cookie').split(';')[0];
    const state=await req('/api/workspace',undefined,guestCookie);assert.equal(state.data.workspace.tasks.length,0);assert.equal(state.data.liveAvailable,false);
    assert.equal((await req('/api/workspace',{action:'document_add',document:{name:'Private',kind:'note',text:'This should not be stored'}},guestCookie)).r.status,403);
    assert.equal((await req('/api/workspace',{action:'task_approve',taskId,approvalHash:w.tasks[0].approvalHash},guestCookie)).r.status,400);
  });
  await t.test('cross-origin and oversized requests fail',async()=>{
    assert.equal((await req('/api/workspace',{action:'seed'},ownerCookie,{headers:{Origin:'https://wrong.example',Cookie:ownerCookie}})).r.status,403);
    assert.equal((await post({action:'document_add',document:{name:'Too large',kind:'note',text:'x'.repeat(24001)}})).r.status,400);
  });
  await t.test('consent and selected evidence are required',async()=>{
    const task={title:'A live task',request:'Prepare a warranty claim',skill:'warranty',mode:'live',documentIds:w.documents.map(d=>d.id)};
    assert.equal((await post({action:'task_create',task})).r.status,400);
    assert.equal((await post({action:'task_create',task:{...task,consent:true,documentIds:['foreign']}})).r.status,400);
    const created=await post({action:'task_create',task:{...task,consent:true}});
    assert.equal((await post({action:'task_run',taskId:created.data.workspace.tasks[0].id,consent:true})).r.status,400);
    assert.equal((await req('/api/workspace')).data.workspace.tasks[0].plan,undefined);
  });
  await t.test('memory persists and can be deleted',async()=>{
    await post({action:'memory_add',memory:{label:'Tone',value:'Concise',shareWithAI:false}});
    const m=(await req('/api/workspace')).data.workspace.memories[0];assert.equal(m.value,'Concise');
    await post({action:'memory_delete',id:m.id});assert.equal((await req('/api/workspace')).data.workspace.memories.length,0);
  });
  await t.test('runner is scoped, idempotent, and revocable',async()=>{
    const token=(await post({action:'automation_enable'})).data.automationToken;
    await post({action:'reminder_update',id:w.reminders[0].id,dueAt:'2026-01-01T00:00:00.000Z'});
    const tick=()=>req('/api/automation/tick',{},'',{headers:{Authorization:`Bearer ${token}`}});
    const a=await tick();assert.equal(a.data.newlyDue,1);assert.equal(a.data.workspace,undefined);assert.equal((await tick()).data.newlyDue,0);
    await post({action:'automation_disable'});assert.equal((await tick()).r.status,401);
  });
  await t.test('logout revokes server session',async()=>{
    const r=await fetch(base+'/api/session',{method:'DELETE',headers:{Origin:base,Cookie:ownerCookie}});assert.equal(r.status,200);
    assert.equal((await req('/api/workspace')).r.status,401);
  });
});
