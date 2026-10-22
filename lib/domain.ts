import { z } from "zod";
export const MODEL = "nvidia/nemotron-3-super-120b-a12b";
export const API_BASE = "https://api.tokenfactory.us-central1.nebius.com/v1";
export const skills = [
  { id: "warranty", name: "Warranty claim", description: "Find the evidence. Prepare your claim. Keep the receipt." },
  { id: "reimbursement", name: "Expense reimbursement", description: "Turn a receipt and expense policy into a reviewable request." },
] as const;
export type Document = { id: string; name: string; kind: "invoice" | "policy" | "note"; text: string; createdAt: string; sample: boolean };
export type Memory = { id: string; label: string; value: string; shareWithAI: boolean };
export type Event = { id: string; at: string; title: string; detail: string; kind: "info" | "success" | "warning" };
export type Plan = { subject: string; body: string; recipient: string; facts: { label: string; value: string; documentId: string; quote: string }[]; missing: string[]; warnings: string[]; summary: string };
export type Task = { id: string; title: string; request: string; skill: "warranty" | "reimbursement"; documentIds: string[]; status: "new" | "needs_info" | "awaiting_approval" | "completed" | "cancelled"; mode: "sample" | "live"; createdAt: string; updatedAt: string; plan?: Plan; approvalHash?: string; events: Event[]; inference?: { model: string; requestId: string; tokens: number; durationMs: number; at: string }; receiptId?: string };
export type Receipt = { id: string; taskId: string; at: string; action: "email_draft"; payloadHash: string; evidence: { id: string; sha256: string }[]; recipient: string; subject: string; body: string; status: "draft_created"; mode: "sample" | "live"; approvedAt: string; contentSha256: string };
export type Reminder = { id: string; taskId: string; title: string; dueAt: string; done: boolean; surfacedAt?: string };
export type Workspace = { documents: Document[]; memories: Memory[]; tasks: Task[]; receipts: Receipt[]; reminders: Reminder[]; seeded: boolean; automationLastRun?: string };
export const planSchema = z.object({
  subject: z.string().min(1).max(200), body: z.string().min(1).max(10000),
  recipient: z.string().max(254).refine(v => v === "" || /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v), "Invalid email"),
  summary: z.string().min(1).max(1000),
  facts: z.array(z.object({label:z.string().max(100),value:z.string().max(1000),documentId:z.string().max(100),quote:z.string().min(1).max(2000)})).max(20),
  missing:z.array(z.string().max(300)).max(20),warnings:z.array(z.string().max(500)).max(20),
});
export const documentSchema=z.object({name:z.string().trim().min(1).max(120),kind:z.enum(["invoice","policy","note"]),text:z.string().trim().min(10).max(24000)});
export const taskSchema=z.object({title:z.string().trim().min(3).max(120),request:z.string().trim().min(10).max(3000),skill:z.enum(["warranty","reimbursement"]),documentIds:z.array(z.string()).min(1).max(8),mode:z.enum(["sample","live"]),consent:z.boolean().optional()});
export const memorySchema=z.object({label:z.string().trim().min(1).max(80),value:z.string().trim().min(1).max(500),shareWithAI:z.boolean()});
export const newId=()=>crypto.randomUUID();
export const now=()=>new Date().toISOString();
export const event=(title:string,detail:string,kind:Event["kind"]="info"):Event=>({id:newId(),at:now(),title,detail,kind});
export const emptyWorkspace=():Workspace=>({documents:[],memories:[],tasks:[],receipts:[],reminders:[],seeded:false});
export function seedWorkspace(w:Workspace) {
  if(w.seeded)return;
  w.seeded=true;
  const createdAt=now();
  const invoice:Document={id:newId(),name:"SoundNest · headphones invoice",kind:"invoice",sample:true,createdAt,text:"SAMPLE DATA — fictional merchant and customer.\nInvoice: SN-2026-0418\nCustomer: Alex Morgan\nEmail: alex@example.com\nProduct: SoundNest Air headphones\nPurchased: 2026-04-18\nAmount: INR 7,499\nSerial: SN-AIR-0426\nPayment card: 4242 (never needed for a claim)"};
  const policy:Document={id:newId(),name:"SoundNest · warranty policy",kind:"policy",sample:true,createdAt,text:"SAMPLE POLICY — fictional terms, not a real merchant.\nSoundNest Air headphones carry a 12-month limited warranty from purchase for manufacturing defects. Accidental damage is excluded. Claims require the invoice number, product name, serial number and a description of the defect. Draft requests may be addressed to support@soundnest.example. Response target: five business days. A claim is not approved until the merchant reviews it."};
  w.documents.push(invoice,policy);
  w.tasks.push({id:newId(),title:"Claim my headphone warranty",request:"My SoundNest Air headphones stopped charging with normal use. Prepare a warranty claim using the invoice and policy. Do not include payment details.",skill:"warranty",documentIds:[invoice.id,policy.id],status:"new",mode:"sample",createdAt,updatedAt:createdAt,events:[event("Sample task ready","Two fictional documents are attached. No account connection is required.")]});
}
export function samplePlan(task:Task,docs:Document[]):Plan {
  const invoice=docs.find(d=>d.kind==="invoice"&&d.sample),policy=docs.find(d=>d.kind==="policy"&&d.sample);
  if(!invoice||!policy||task.skill!=="warranty")throw new Error("Sample mode only supports the included headphone warranty example. Choose live mode for your own documents.");
  return {summary:"The sample policy describes 12 months of coverage. Prepare a claim for merchant review; eligibility is not guaranteed.",
    subject:"Warranty request — SoundNest Air / SN-2026-0418",recipient:"support@soundnest.example",
    body:"Hello SoundNest support,\n\nI would like to request warranty assistance for my SoundNest Air headphones, purchased on 18 April 2026.\n\nInvoice: SN-2026-0418\nSerial number: SN-AIR-0426\nIssue: The headphones have stopped charging during normal use.\n\nYour supplied policy describes a 12-month limited warranty for manufacturing defects. Please confirm whether this issue is covered and advise on the next steps. I can provide the invoice through your approved channel if needed.\n\nThank you.",
    facts:[{label:"Invoice",value:"SN-2026-0418",documentId:invoice.id,quote:"Invoice: SN-2026-0418"},{label:"Purchased",value:"18 April 2026",documentId:invoice.id,quote:"Purchased: 2026-04-18"},{label:"Coverage",value:"12-month limited warranty",documentId:policy.id,quote:"12-month limited warranty from purchase for manufacturing defects."},{label:"Recipient",value:"support@soundnest.example",documentId:policy.id,quote:"support@soundnest.example"}],
    missing:[],warnings:["Fictional sample: the .example address cannot receive email.","A prepared draft is not a submitted or accepted warranty claim."]};
}
export function validateEvidence(plan:Plan,docs:Document[]) {
  for(const fact of plan.facts) {
    const doc=docs.find(d=>d.id===fact.documentId);
    if(!doc||!doc.text.includes(fact.quote))throw new Error("AI evidence could not be matched to the selected source. Review documents and retry.");
  }
  if(plan.recipient&&!docs.some(d=>d.text.toLowerCase().includes(plan.recipient.toLowerCase())))throw new Error("Recipient was not found in the selected evidence. Add a source containing the official contact address.");
  if(plan.facts.length===0&&plan.missing.length===0)throw new Error("The plan has no source evidence.");
  if(/[\r\n]/.test(plan.subject)||/[\r\n]/.test(plan.recipient))throw new Error("Invalid email header.");
}
export async function sha256(text:string) {
  const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
export async function approvalHash(task:Task,docs:Document[]) {
  return sha256(JSON.stringify({taskId:task.id,action:"email_draft",plan:task.plan,evidence:await Promise.all(docs.map(async d=>({id:d.id,sha256:await sha256(d.text)})))}));
}
export function eml(receipt:Pick<Receipt,"recipient"|"subject"|"body">) {
  const encodedSubject=Array.from(new TextEncoder().encode(receipt.subject)).map(b=>String.fromCharCode(b)).join("");
  const bodyBytes=Array.from(new TextEncoder().encode(receipt.body.replace(/\r?\n/g,"\r\n"))).map(b=>String.fromCharCode(b)).join("");
  const content=btoa(bodyBytes).match(/.{1,76}/g)?.join("\r\n")||"";
  return `To: ${receipt.recipient}\r\nSubject: =?UTF-8?B?${btoa(encodedSubject)}?=\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\nX-Unsent: 1\r\n\r\n${content}\r\n`;
}
export function processFollowups(w:Workspace,at=now()) {
  let due=0;
  for(const reminder of w.reminders) {
    if(!reminder.done&&!reminder.surfacedAt&&reminder.dueAt<=at) {
      reminder.surfacedAt=at;
      const task=w.tasks.find(t=>t.id===reminder.taskId);
      if(task)task.events.push({...event("Follow-up is due","The background runner marked this reminder due. Review whether you sent the draft before following up.","warning"),at});
      due++;
    }
  }
  w.automationLastRun=at;
  return due;
}
