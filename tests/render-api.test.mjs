import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {mkdir,rm} from 'node:fs/promises';
import {resolve,relative,isAbsolute} from 'node:path';
import {createServer} from 'node:net';
import {createServer as createHttpServer} from 'node:http';
import {createClient} from '@libsql/client';
import {build} from 'esbuild';
const port=await new Promise(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const base=`http://127.0.0.1:${port}`,ownerKey=randomBytes(32).toString('hex');
const stateDir=resolve('.test-state',crypto.randomUUID());
await mkdir(stateDir,{recursive:true});
const serverEnv={...process.env,APP_URL:base,DATABASE_PATH:resolve(stateDir,'qa.sqlite'),TURSO_DATABASE_URL:'',TURSO_AUTH_TOKEN:'',REQUIRE_REMOTE_DB:'false',NEBIUS_API_KEY:'',PROOFPILOT_OWNER_KEY:ownerKey,PROOFPILOT_JUDGE_KEY:'',FOLLOWUP_SCANNER:'false',NEXT_TELEMETRY_DISABLED:'1'};
let logs='';
function startServer(overrides={}) {
  const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env:{...serverEnv,...overrides},stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',c=>logs+=c);child.stderr.on('data',c=>logs+=c);return child;
}
let server=startServer();
const inspection=createClient({url:`file:${resolve(stateDir,'qa.sqlite').replace(/\\/g,'/')}`});
async function stopServer(){if(server.exitCode===null&&server.signalCode===null){const exited=new Promise(r=>server.once('exit',r));server.kill();await exited;}}
async function waitForServer(path='/api/health') {
  for(let i=0;i<60;i++){try{const r=await fetch(base+path);if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,500));}
  assert.fail('Server did not become ready: '+logs.slice(-3000));
}
let ownerCookie='',guestCookie='';
async function req(path,body,cookie=ownerCookie,options={}){
  const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie,...options.headers},...(body===undefined?{}:{body:JSON.stringify(body)}),...options,signal:AbortSignal.timeout(15000)});
  return {r,data:await r.json()};
}
const post=payload=>req('/api/workspace',payload);
test('Render server: sessions, evidence and approvals',async t=>{
  t.after(async()=>{await stopServer();inspection.close();const child=relative(resolve('.test-state'),stateDir);assert.ok(child&&!child.startsWith('..')&&!isAbsolute(child));await rm(stateDir,{recursive:true,force:true});});
  await waitForServer();
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
  const signup={action:'signup',name:'First user',email:'first@example.test',password:'eight123',confirmPassword:'eight123'};
  let accountCookie='',accountId;
  const signout=cookie=>fetch(base+'/api/session',{method:'DELETE',headers:{Origin:base,Cookie:cookie}});
  await t.test('signup validates eight-character minimum, email, confirmation and origin',async()=>{
    for(const change of [{password:'seven12',confirmPassword:'seven12'},{confirmPassword:'different'},{email:'invalid'},{name:'   '},{password:'x'.repeat(129),confirmPassword:'x'.repeat(129)}]) {
      assert.equal((await req('/api/session',{...signup,...change},'')).r.status,400);
    }
    assert.equal((await req('/api/session',signup,'',{headers:{Origin:'https://wrong.example'}})).r.status,403);
  });
  await t.test('first account accepts exactly eight characters without taking owner data',async()=>{
    const {r,data}=await req('/api/session',{...signup,userId:'owner',role:'owner'},'');
    assert.equal(r.status,200);assert.deepEqual(data,{ok:true});
    const c=r.headers.get('set-cookie');assert.match(c,/HttpOnly/i);assert.match(c,/Secure/i);assert.match(c,/SameSite=strict/i);accountCookie=c.split(';')[0];
    const state=await req('/api/workspace',undefined,accountCookie);
    assert.equal(state.data.user.name,'First user');assert.equal(state.data.user.role,'member');assert.equal(state.data.workspace.tasks.length,0);
    const row=(await inspection.execute("SELECT user_id,password_hash FROM accounts WHERE email='first@example.test'")).rows[0];accountId=String(row.user_id);
    assert.notEqual(accountId,'owner');assert.match(row.password_hash,/^scrypt-v1\$/);assert.ok(!row.password_hash.includes(signup.password));
    assert.equal((await req('/api/workspace',{action:'memory_add',memory:{label:'My note',value:'Keep this after signout',shareWithAI:false}},accountCookie)).r.status,200);
  });
  await t.test('email normalization and duplicate signup cannot replace an account',async()=>{
    assert.equal((await req('/api/session',{...signup,email:' FIRST@EXAMPLE.TEST ',password:'another8',confirmPassword:'another8'},'')).r.status,409);
    assert.equal((await req('/api/session',{action:'login',email:'first@example.test',password:'another8'},'')).r.status,401);
  });
  await t.test('wrong password and unknown email give the same response',async()=>{
    const a=await req('/api/session',{action:'login',email:signup.email,password:'wrong123'},'');
    const b=await req('/api/session',{action:'login',email:'absent@example.test',password:'wrong123'},'');
    assert.equal(a.r.status,401);assert.equal(b.r.status,401);assert.deepEqual(a.data,b.data);
  });
  await t.test('a second account is isolated and gets its own password salt',async()=>{
    const {r}=await req('/api/session',{...signup,email:'second@example.test',name:'Second user'},'');assert.equal(r.status,200);
    const cookie=r.headers.get('set-cookie').split(';')[0];
    assert.equal((await req('/api/workspace',undefined,cookie)).data.workspace.memories.length,0);
    const rows=(await inspection.execute("SELECT password_hash FROM accounts WHERE email IN ('first@example.test','second@example.test')")).rows;
    assert.notEqual(rows[0].password_hash,rows[1].password_hash);await signout(cookie);
  });
  await t.test('expired account sessions are cleaned without deleting saved data',async()=>{
    await inspection.execute({sql:'UPDATE sessions SET expires_at=0 WHERE user_id=?',args:[accountId]});
    const bundle=resolve(stateDir,'scheduler.cjs');
    await build({entryPoints:['lib/scheduler.ts'],bundle:true,platform:'node',format:'cjs',packages:'external',outfile:bundle,logLevel:'silent'});
    const result=spawnSync(process.execPath,['-e','require(process.argv[1]).scanReminders().then(()=>process.exit(0)).catch(()=>process.exit(1))',bundle],{env:serverEnv,encoding:'utf8',timeout:15000});
    assert.equal(result.status,0,result.stderr);
    assert.equal((await req('/api/workspace',undefined,accountCookie)).r.status,401);
    assert.equal((await inspection.execute({sql:'SELECT COUNT(*) AS count FROM workspaces WHERE user_id=?',args:[accountId]})).rows[0].count,1);
  });
  await t.test('email/password restores workspace after restart and logout',async()=>{
    await stopServer();server=startServer();await waitForServer();
    const login=()=>req('/api/session',{action:'login',email:' FIRST@EXAMPLE.TEST ',password:signup.password},'');
    const {r}=await login();assert.equal(r.status,200);accountCookie=r.headers.get('set-cookie').split(';')[0];
    assert.equal((await req('/api/workspace',undefined,accountCookie)).data.workspace.memories[0].value,'Keep this after signout');
    await signout(accountCookie);assert.equal((await req('/api/workspace',undefined,accountCookie)).r.status,401);
    assert.equal((await login()).r.status,200);
  });
  await t.test('existing owner data requires the actual key and can be linked only once',async()=>{
    const input={...signup,email:'owner-link@example.test',workspaceKey:'not-the-owner-key'};
    assert.equal((await req('/api/session',input,'')).r.status,401);
    const {r}=await req('/api/session',{...input,workspaceKey:ownerKey},'');assert.equal(r.status,200);
    const cookie=r.headers.get('set-cookie').split(';')[0];
    assert.equal((await req('/api/workspace',undefined,cookie)).data.workspace.receipts.length,1);
    assert.equal((await req('/api/session',{...input,email:'takeover@example.test',workspaceKey:ownerKey},'')).r.status,409);
  });
  await t.test('concurrent signup cannot create duplicate email identities',async()=>{
    const input={...signup,email:'race@example.test'};
    const results=await Promise.all([req('/api/session',input,''),req('/api/session',input,'')]);
    assert.deepEqual(results.map(x=>x.r.status).sort(),[200,409]);
    assert.equal((await inspection.execute("SELECT COUNT(*) AS count FROM accounts WHERE email='race@example.test'")).rows[0].count,1);
  });
  await t.test('password guessing is rate limited by normalized email',async()=>{
    for(let i=0;i<10;i++)assert.equal((await req('/api/session',{action:'login',email:'rate@example.test',password:'wrong123'},'')).r.status,401);
    assert.equal((await req('/api/session',{action:'login',email:' RATE@EXAMPLE.TEST ',password:'wrong123'},'')).r.status,429);
  });
  await t.test('database authorization failure returns readable JSON instead of an empty response',async()=>{
    const stub=createHttpServer((_req,res)=>{res.writeHead(401,{'Content-Type':'application/json'});res.end('{"error":"unauthorized"}');});
    await new Promise(r=>stub.listen(0,'127.0.0.1',r));
    try {
      await stopServer();server=startServer({TURSO_DATABASE_URL:`http://127.0.0.1:${stub.address().port}`,TURSO_AUTH_TOKEN:'synthetic-invalid-token',REQUIRE_REMOTE_DB:'true'});await waitForServer('/login');
      const {r,data}=await req('/api/session',{demo:true},'');
      assert.equal(r.status,503);assert.match(r.headers.get('content-type'),/application\/json/);assert.match(data.error,/database/i);
      assert.ok(!JSON.stringify(data).includes('synthetic-invalid-token'));
    } finally { await stopServer();await new Promise(r=>stub.close(r)); }
  });
});
