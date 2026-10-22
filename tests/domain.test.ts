import test from "node:test";
import assert from "node:assert/strict";
import { emptyWorkspace,seedWorkspace,samplePlan,validateEvidence,approvalHash,eml,planSchema,sha256,processFollowups } from "../lib/domain";
import { preparePlan } from "../lib/agent";
import { normalizeDatabaseToken, tokenFormat, parseDatabaseTokenFile, loadDatabaseToken } from "../lib/database-config";
test("database token copy formats preserve the credential",()=>{
  for(const value of ["fixture.token.signature", "  fixture.token.signature\n", '"fixture.token.signature"', "'fixture.token.signature'", 'TURSO_AUTH_TOKEN="fixture.token.signature"'])assert.equal(normalizeDatabaseToken(value),"fixture.token.signature");
  assert.equal(normalizeDatabaseToken("opaque-token"),"opaque-token");
  assert.equal(normalizeDatabaseToken("   "),undefined);
});
test("database diagnostics report only a format label",()=>{
  assert.equal(tokenFormat(),"missing");assert.equal(tokenFormat("fixture.token.signature"),"jwt");assert.equal(tokenFormat("a\nb"),"multiple_lines");assert.equal(tokenFormat("opaque-token"),"unrecognized");
});
test("secret files accept raw tokens, dotenv entries and staged JSON",()=>{
  const token="fixture.token.signature";
  for(const value of [token,`# private configuration\nTURSO_DATABASE_URL=libsql://fixture.test\nTURSO_AUTH_TOKEN="${token}"\nOTHER_KEY=ignored`,JSON.stringify({tursoAuthToken:token}),JSON.stringify({TURSO_AUTH_TOKEN:token})])assert.equal(parseDatabaseTokenFile(value),token);
});
test("invalid secret file content is rejected without exposing it",()=>{
  for(const value of ["", "OTHER_KEY=private-value", '{"tursoAuthToken":123}', '{"tursoAuthToken":', "private-value\nsecond-line"]) {
    assert.throws(()=>parseDatabaseTokenFile(value),error=>error instanceof Error&&/Database secret file/.test(error.message)&&!error.message.includes("private-value"));
  }
});
test("an explicit environment credential takes precedence and missing files fail closed",()=>{
  assert.deepEqual(loadDatabaseToken("fixture.token.signature","relative-nonexistent"),{token:"fixture.token.signature",source:"environment"});
  assert.deepEqual(loadDatabaseToken(""),{token:undefined,source:"missing"});
  assert.throws(()=>loadDatabaseToken("","relative-nonexistent"),/path must be absolute/);
});
function fixture() {const w=emptyWorkspace();seedWorkspace(w);const t=w.tasks[0];t.plan=samplePlan(t,w.documents);return {w,t};}
test("sample seeds once and uses only fictional documents",()=>{const {w}=fixture();seedWorkspace(w);assert.equal(w.tasks.length,1);assert.equal(w.documents.length,2);assert.ok(w.documents.every(d=>d.sample));});
test("sample claims contain verifiable source quotes",()=>{const {w,t}=fixture();validateEvidence(t.plan!,w.documents);assert.equal(t.plan!.missing.length,0);});
test("invented source quote is rejected",()=>{const {w,t}=fixture();t.plan!.facts[0].quote="Guaranteed replacement in 24 hours";assert.throws(()=>validateEvidence(t.plan!,w.documents),/could not be matched/);});
test("unselected source is rejected",()=>{const {w,t}=fixture();assert.throws(()=>validateEvidence(t.plan!,w.documents.slice(1)),/could not be matched/);});
test("recipient not found in sources is rejected",()=>{const {w,t}=fixture();t.plan!.recipient="attacker@evil.example";assert.throws(()=>validateEvidence(t.plan!,w.documents),/Recipient/);});
test("email header injection is rejected",()=>{const {w,t}=fixture();t.plan!.subject="Claim\r\nBcc: attacker@example.com";assert.throws(()=>validateEvidence(t.plan!,w.documents),/header/);});
test("editing a draft invalidates its approval hash",async()=>{const {w,t}=fixture();const first=await approvalHash(t,w.documents);t.plan!.body+="\nAn additional detail.";assert.notEqual(await approvalHash(t,w.documents),first);});
test("changing evidence invalidates its approval hash",async()=>{const {w,t}=fixture();const first=await approvalHash(t,w.documents);w.documents[0].text+="\nChanged";assert.notEqual(await approvalHash(t,w.documents),first);});
test("UTF-8 email remains an unsent draft",()=>{const file=eml({subject:"Claim ₹7,499",recipient:"help@example.com",body:"Please review my ₹7,499 claim."});assert.match(file,/X-Unsent: 1/);assert.ok(!file.includes("Bcc:"));const encoded=file.split("\r\n\r\n")[1].replace(/\s/g,"");assert.match(Buffer.from(encoded,"base64").toString("utf8"),/₹7,499/);});
test("schema rejects malformed model plans",()=>{assert.equal(planSchema.safeParse({subject:"x"}).success,false);});
test("sample inference makes no network request",async()=>{const {w,t}=fixture();const original=globalThis.fetch;globalThis.fetch=()=>{throw new Error("Unexpected network request");};try {const r=await preparePlan(t,w.documents,[]);assert.ok(r.plan);assert.equal(r.inference,undefined);}finally{globalThis.fetch=original;}});
test("live mode fails closed without a key",async()=>{const {w,t}=fixture();t.mode="live";await assert.rejects(preparePlan(t,w.documents,[]),/not configured/);});
test("sample mode cannot process user documents",async()=>{const {w,t}=fixture();w.documents.forEach(d=>d.sample=false);await assert.rejects(preparePlan(t,w.documents,[]),/Sample mode only/);});
test("only opted-in memories reach mocked inference; live receipt is captured",async()=>{
  const {w,t}=fixture();t.mode="live";const original=globalThis.fetch;let sent:any;
  globalThis.fetch=async(url,init)=>{assert.match(String(url),/^https:\/\/api\.tokenfactory\.us-central1\.nebius\.com\/v1\/chat\/completions$/);sent=JSON.parse(String(init!.body));return Response.json({id:"mock-request-id",choices:[{message:{content:JSON.stringify(t.plan)}}],usage:{total_tokens:321}});};
  try{const r=await preparePlan(t,w.documents,[{id:"1",label:"Tone",value:"Concise",shareWithAI:true},{id:"2",label:"Private",value:"Do not transmit",shareWithAI:false}],"test-key");assert.equal(JSON.parse(sent.messages[1].content).preferences.length,1);assert.ok(!JSON.stringify(sent).includes("Do not transmit"));assert.equal(r.inference?.requestId,"mock-request-id");}
  finally{globalThis.fetch=original;}
});
test("provider error never becomes sample success",async()=>{const {w,t}=fixture();t.mode="live";const original=globalThis.fetch;globalThis.fetch=async()=>new Response("secret provider error",{status:401});try{await assert.rejects(preparePlan(t,w.documents,[],"test"),/HTTP 401/);}finally{globalThis.fetch=original;}});
test("content digest is stable",async()=>{assert.equal((await sha256("proofpilot")).length,64);assert.equal(await sha256("proofpilot"),await sha256("proofpilot"));});
test("background follow-ups are idempotent and skip future/completed reminders",()=>{
  const {w,t}=fixture();
  w.reminders=[{id:"due",taskId:t.id,title:"Follow up",dueAt:"2026-10-01T00:00:00.000Z",done:false},{id:"future",taskId:t.id,title:"Future",dueAt:"2027-01-01T00:00:00.000Z",done:false},{id:"done",taskId:t.id,title:"Done",dueAt:"2026-01-01T00:00:00.000Z",done:true}];
  const count=t.events.length;
  assert.equal(processFollowups(w,"2026-10-20T00:00:00.000Z"),1);
  assert.equal(processFollowups(w,"2026-10-20T00:01:00.000Z"),0);
  assert.equal(t.events.length,count+1);
});
