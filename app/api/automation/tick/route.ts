import { getDb } from "../../../../db";
import { workspaces,automationTokens } from "../../../../db/schema";
import { and,eq } from "drizzle-orm";
import { Workspace,now,sha256,processFollowups } from "../../../../lib/domain";
export const dynamic="force-dynamic";
export async function POST(req:Request) {
  const token=req.headers.get("authorization")?.replace(/^Bearer /,"");
  const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
  if(!token||!/^pp_[a-f0-9]{64}$/.test(token))return reply({error:"Invalid runner token."},401);
  const db=await getDb();
  const [identity]=await db.select().from(automationTokens).where(eq(automationTokens.tokenHash,await sha256(token)));
  if(!identity)return reply({error:"Invalid runner token."},401);
  // The token grants only a scan of its owner's reminders. It cannot read the
  // vault, run inference, alter drafts or authorize an external action.
  for(let attempt=0;attempt<3;attempt++) {
    const [row]=await db.select().from(workspaces).where(eq(workspaces.userId,identity.userId));
    if(!row)return reply({error:"Workspace unavailable."},404);
    const w=JSON.parse(row.data) as Workspace,checkedAt=now();
    const due=processFollowups(w,checkedAt);
    const updated=await db.update(workspaces).set({data:JSON.stringify(w),version:row.version+1,updatedAt:checkedAt}).where(and(eq(workspaces.userId,identity.userId),eq(workspaces.version,row.version))).returning({version:workspaces.version});
    if(updated.length)return reply({checkedAt,newlyDue:due,pending:w.reminders.filter(r=>!r.done).length});
  }
  return reply({error:"Workspace is busy. Retry on the next interval."},409);
}
