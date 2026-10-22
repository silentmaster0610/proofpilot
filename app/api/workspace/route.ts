import { getUser,validOrigin } from "../../../lib/auth";
import { getDb,consumeLimit } from "../../../db";
import { workspaces,automationTokens } from "../../../db/schema";
import { and,eq } from "drizzle-orm";
import { z } from "zod";
import { Workspace,Task,Receipt,emptyWorkspace,seedWorkspace,documentSchema,memorySchema,taskSchema,event,newId,now,approvalHash,sha256,eml,validateEvidence,MODEL } from "../../../lib/domain";
import { preparePlan } from "../../../lib/agent";
export const dynamic="force-dynamic";
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
async function load() {
  const user=await getUser();
  if(!user)throw new Error("AUTH_REQUIRED");
  const db=await getDb();
  await db.insert(workspaces).values({userId:user.userId,data:JSON.stringify(emptyWorkspace()),version:0,updatedAt:now()}).onConflictDoNothing();
  const [row]=await db.select().from(workspaces).where(eq(workspaces.userId,user.userId));
  return {db,row,user,w:JSON.parse(row.data) as Workspace};
}
export async function GET() {
  try {const {w,user,db}=await load();const tokens=await db.select({userId:automationTokens.userId}).from(automationTokens).where(eq(automationTokens.userId,user.userId));return response({workspace:w,user:{name:user.displayName,role:user.role},liveAvailable:user.role!=="demo"&&Boolean(process.env.NEBIUS_API_KEY),automationEnabled:tokens.length>0,schedulerEnabled:process.env.FOLLOWUP_SCANNER!=="false",model:process.env.NEBIUS_MODEL||MODEL});}
  catch(e){return fail(e);}
}
function fail(e:unknown) {
  if(e instanceof Error&&e.message==="AUTH_REQUIRED")return response({error:"Sign in to open your private workspace."},401);
  if(e instanceof z.ZodError)return response({error:"Please check the form fields.",details:e.issues.map(i=>i.message)},400);
  const message=e instanceof Error?e.message:"Request failed.";
  const expected=/^(Live AI|Sample mode|Nebius |The AI|AI evidence|Recipient|The plan|Invalid|Please|Task |Selected|Approval|This |Too many|Document |Memory |Reminder |Workspace |Missing|Read |Only |Sign)/.test(message);
  return response({error:expected?message:"The workspace could not complete this request. Please retry."},message.startsWith("Workspace changed")?409:400);
}
export async function POST(req:Request) {
  try {
    const raw=await req.text();
    if(raw.length>60000)return response({error:"Document is too large."},413);
    if(!validOrigin(req))return response({error:"Invalid request origin."},403);
    const input=JSON.parse(raw);
    const {db,row,user,w}=await load();
    if(user.role==="demo"&&!["seed","task_run","task_edit","task_approve","reminder_update","task_cancel"].includes(input.action))return response({error:"Sign in with an access key to use your own documents and memories."},403);
    if(input.action==="automation_enable") {
      const token=`pp_${newId().replace(/-/g,"")}${newId().replace(/-/g,"")}`;
      const tokenHash=await sha256(token);
      await db.insert(automationTokens).values({userId:user.userId,tokenHash,createdAt:now()}).onConflictDoUpdate({target:automationTokens.userId,set:{tokenHash,createdAt:now()}});
      return response({workspace:w,automationToken:token,automationEnabled:true});
    }
    if(input.action==="automation_disable") {
      await db.delete(automationTokens).where(eq(automationTokens.userId,user.userId));
      return response({workspace:w,automationEnabled:false});
    }
    const task=()=>{const t=w.tasks.find(t=>t.id===input.taskId);if(!t)throw new Error("Task not found.");return t;};
    switch(input.action) {
      case "seed":seedWorkspace(w);break;
      case "document_add":{
        if(w.documents.length>=60)throw new Error("Too many documents. Remove an unused document first.");
        w.documents.unshift({...documentSchema.parse(input.document),id:newId(),createdAt:now(),sample:false});break;
      }
      case "document_delete":{
        if(w.tasks.some(t=>t.documentIds.includes(input.id)&&t.status!=="cancelled"))throw new Error("Document is used by a task. Cancel its task before removing it.");
        w.documents=w.documents.filter(d=>d.id!==input.id);break;
      }
      case "memory_add":{
        if(w.memories.length>=30)throw new Error("Too many memories.");
        w.memories.push({...memorySchema.parse(input.memory),id:newId()});break;
      }
      case "memory_delete":w.memories=w.memories.filter(m=>m.id!==input.id);break;
      case "task_create":{
        if(w.tasks.length>=100)throw new Error("Too many tasks.");
        const v=taskSchema.parse(input.task);
        if(v.documentIds.some(id=>!w.documents.some(d=>d.id===id)))throw new Error("Selected document was not found.");
        if(v.mode==="live"&&!v.consent)throw new Error("Please consent to sending selected documents and enabled memories to Nebius.");
        const t:Task={id:newId(),title:v.title,request:v.request,skill:v.skill,documentIds:[...new Set(v.documentIds)],mode:v.mode,status:"new",createdAt:now(),updatedAt:now(),events:[event("Task created",v.mode==="live"?"Cloud processing consent recorded for selected documents and enabled preferences.":"Sample mode; no inference call.")]};
        w.tasks.unshift(t);break;
      }
      case "task_run":{
        const t=task();if(!["new","needs_info"].includes(t.status))throw new Error("Task cannot run in its current state.");
        const docs=w.documents.filter(d=>t.documentIds.includes(d.id));
        if(docs.length!==t.documentIds.length)throw new Error("Selected evidence is missing.");
        if(!docs.some(d=>d.kind==="invoice")||!docs.some(d=>d.kind==="policy")){t.status="needs_info";t.events.push(event("More evidence needed","Attach an invoice and policy before preparing the draft.","warning"));break;}
        if(t.mode==="live"&&input.consent!==true)throw new Error("Please consent to cloud processing before running live AI.");
        if(t.mode==="live") {
          if(user.role==="demo")throw new Error("Sign in with an access key to use live AI.");
          const daily=Number(process.env.LIVE_DAILY_LIMIT||30);
          if(!await consumeLimit(`inference:${user.role}:${new Date().toISOString().slice(0,10)}`,daily,86400000))throw new Error("Live AI daily limit reached. Try again tomorrow.");
        }
        const result=await preparePlan(t,docs,w.memories,process.env.NEBIUS_API_KEY);
        validateEvidence(result.plan,docs);t.plan=result.plan;t.inference=result.inference;
        t.status=result.plan.missing.length||!result.plan.recipient?"needs_info":"awaiting_approval";
        t.approvalHash=await approvalHash(t,docs);t.updatedAt=now();
        t.events.push(event("Evidence inspected",`${docs.length} selected documents. ${t.plan.facts.length} quotes matched to source text.`,"success"));
        t.events.push(event(t.mode==="live"?"Nemotron prepared the claim":"Sample draft prepared",t.mode==="live"?`${result.inference?.model||MODEL} via Nebius Token Factory.`:"Deterministic fictional example; no model call."));
        t.events.push(event(t.status==="needs_info"?"Needs your input":"Ready for your review",t.status==="needs_info"?t.plan.missing.join("; ")||"Add a source with the recipient email.":"Nothing has been sent. Review the exact recipient and text before creating an email file.",t.status==="needs_info"?"warning":"info"));break;
      }
      case "task_evidence":{
        const t=task();if(t.status==="completed")throw new Error("Task already completed.");
        const ids=z.array(z.string()).min(1).max(8).parse(input.documentIds);
        if(ids.some(id=>!w.documents.some(d=>d.id===id)))throw new Error("Selected document was not found.");
        t.documentIds=[...new Set(ids)];t.status="new";delete t.plan;delete t.approvalHash;t.updatedAt=now();
        t.events.push(event("Evidence updated","Previous draft and approval were invalidated."));break;
      }
      case "task_edit":{
        const t=task();if(!t.plan||t.status==="completed"||t.status==="cancelled")throw new Error("Task draft cannot be edited.");
        const edit=z.object({subject:z.string().trim().min(1).max(200).refine(s=>!/[\r\n]/.test(s)),body:z.string().trim().min(10).max(10000)}).parse(input);
        t.plan.subject=edit.subject;t.plan.body=edit.body;t.approvalHash=await approvalHash(t,w.documents.filter(d=>t.documentIds.includes(d.id)));
        t.events.push(event("Draft edited","The approval fingerprint was renewed for this exact text."));break;
      }
      case "task_approve":{
        const t=task();if(t.status==="completed"&&t.receiptId)break;
        if(t.status!=="awaiting_approval"||!t.plan)throw new Error("Task is not ready for approval.");
        const docs=w.documents.filter(d=>t.documentIds.includes(d.id)),fingerprint=await approvalHash(t,docs);
        if(input.approvalHash!==fingerprint)throw new Error("Approval is stale. Reload and review the latest draft.");
        const at=now();
        const r:Receipt={id:newId(),taskId:t.id,at,approvedAt:at,action:"email_draft",payloadHash:fingerprint,evidence:await Promise.all(docs.map(async d=>({id:d.id,sha256:await sha256(d.text)}))),recipient:t.plan.recipient,subject:t.plan.subject,body:t.plan.body,status:"draft_created",mode:t.mode,contentSha256:""};
        r.contentSha256=await sha256(eml(r));w.receipts.unshift(r);t.receiptId=r.id;t.status="completed";t.updatedAt=at;
        t.events.push(event("Email draft created","Approved text saved as an email file. Not sent to the merchant.","success"));
        t.events.push(event("Receipt stored","Draft fingerprint, source hashes and approval timestamp saved.","success"));
        w.reminders.push({id:newId(),taskId:t.id,title:`Send or follow up: ${t.title}`,dueAt:new Date(Date.now()+3*86400000).toISOString(),done:false});break;
      }
      case "task_cancel":{const t=task();if(t.status==="completed")throw new Error("Task already completed.");t.status="cancelled";delete t.approvalHash;t.events.push(event("Task cancelled","No external action was performed."));break;}
      case "reminder_update":{
        const r=w.reminders.find(r=>r.id===input.id);if(!r)throw new Error("Reminder not found.");
        if(typeof input.done==="boolean")r.done=input.done;
        if(input.dueAt){r.dueAt=z.string().datetime().parse(input.dueAt);delete r.surfacedAt;}break;
      }
      default:return response({error:"Invalid action."},400);
    }
    const updated=await db.update(workspaces).set({data:JSON.stringify(w),version:row.version+1,updatedAt:now()}).where(and(eq(workspaces.userId,user.userId),eq(workspaces.version,row.version))).returning({version:workspaces.version});
    if(!updated.length)throw new Error("Workspace changed in another tab. Reload before retrying.");
    return response({workspace:w});
  }catch(e){return fail(e);}
}
