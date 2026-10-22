// No secrets in command arguments. Load an ignored .worker.env with Node's
// --env-file flag, or inject these values through your worker host.
const base=new URL(process.env.PROOFPILOT_URL||"http://127.0.0.1:3000");
if(base.protocol!=="https:"&&!["127.0.0.1","localhost"].includes(base.hostname))throw new Error("Use HTTPS for a remote workspace.");
const token=process.env.PROOFPILOT_WORKER_TOKEN;
if(!token)throw new Error("Set PROOFPILOT_WORKER_TOKEN from Settings → Follow-up reminders.");
const headers={Authorization:`Bearer ${token}`};
async function tick() {
  const r=await fetch(new URL("/api/automation/tick",base),{method:"POST",headers,signal:AbortSignal.timeout(20000),redirect:"error"});
  if(!r.ok)throw new Error(`Runner request failed (${r.status}). Check the runner token and application health.`);
  const result=await r.json();
  console.log(JSON.stringify({checkedAt:result.checkedAt,newlyDue:result.newlyDue,pending:result.pending}));
}
if(process.argv.includes("--once")){await tick();}
else {
  console.log("ProofPilot follow-up runner started. Interval: 60 seconds. No email will be sent.");
  let stopped=false;
  process.on("SIGTERM",()=>{stopped=true;});
  process.on("SIGINT",()=>{stopped=true;});
  while(!stopped) {
    try{await tick();}catch(e){console.error(e.message);}
    if(!stopped)await new Promise(resolve=>{
      const finish=()=>{clearTimeout(timer);process.off("SIGTERM",finish);process.off("SIGINT",finish);resolve();};
      const timer=setTimeout(finish,60000);
      process.once("SIGTERM",finish);process.once("SIGINT",finish);
    });
  }
}
