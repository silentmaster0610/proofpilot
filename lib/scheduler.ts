import { getClient } from "../db";
import { processFollowups, now, Workspace } from "./domain";
let started = false;
export async function scanReminders() {
  const db=await getClient(),checkedAt=now();
    const result=await db.execute("SELECT user_id,data,version FROM workspaces");
    const rows=result.rows as unknown as {user_id:string;data:string;version:number}[];
    for(const row of rows) {
      const w=JSON.parse(row.data) as Workspace;
      if(!w.reminders.some(r=>!r.done))continue;
      processFollowups(w,checkedAt);
      await db.execute({sql:"UPDATE workspaces SET data=?,version=version+1,updated_at=? WHERE user_id=? AND version=?",args:[JSON.stringify(w),checkedAt,row.user_id,row.version]});
    }
    await db.batch([
      {sql:"DELETE FROM sessions WHERE expires_at<?",args:[Date.now()]},
      "DELETE FROM workspaces WHERE user_id!='owner' AND user_id NOT IN (SELECT user_id FROM accounts) AND user_id NOT IN (SELECT user_id FROM sessions)",
      "DELETE FROM automation_tokens WHERE user_id NOT IN (SELECT user_id FROM workspaces)",
      {sql:"DELETE FROM rate_limits WHERE reset_at<?",args:[Date.now()]}
    ],"write");
}
export function startScheduler() {
  if(started||process.env.FOLLOWUP_SCANNER==="false")return;
  started=true;
  let running=false;
  const tick=async()=>{if(running)return;running=true;try{await scanReminders();}catch{console.error("ProofPilot reminder scan failed; will retry.");}finally{running=false;}};
  tick();setInterval(tick,60000).unref();
}
