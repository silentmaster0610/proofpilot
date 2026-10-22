"use client";
import { useState, FormEvent } from "react";
import { ArrowRight, CheckCheck, ShieldCheck, FileText, Fingerprint, Loader2 } from "lucide-react";
import ThemeToggle from "../theme-toggle";
export default function Login() {
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  async function enter(key?:string) {
    setBusy(true);setError("");
    try {
      const r=await fetch("/api/session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(key?{key}:{demo:true})});
      const d=await r.json();if(!r.ok)throw new Error(d.error);
      location.assign("/");
    }catch(e){setError((e as Error).message);setBusy(false);}
  }
  function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();enter(String(new FormData(e.currentTarget).get("key")||""));}
  return <div className="login-page"><header><a className="brand" href="/"><span className="brand-icon"><CheckCheck/></span>ProofPilot<span className="brand-dot">.</span></a><ThemeToggle/></header>
    <main className="login-grid"><section className="login-story"><p className="eyebrow">YOUR PAPERWORK. YOUR POWER.</p><h1>Life happens.<br/><em>Keep the proof.</em></h1><p>Turn receipts and policies into a clear next step. An assistant that finds the evidence, prepares the words, and leaves the decision with you.</p>
    <div className="login-features"><div><FileText/><span>Evidence you can trace</span></div><div><ShieldCheck/><span>Approval before action</span></div><div><Fingerprint/><span>A record of every draft</span></div></div><small>Built for NVIDIA Nemotron on Nebius Token Factory</small></section>
    <section className="panel login-card"><span className="large-icon"><ShieldCheck size={28}/></span><p className="eyebrow">WELCOME TO YOUR WORKSPACE</p><h2>A little less on your mind.</h2><p>Use your private access key to pick up where you left off.</p><form onSubmit={submit}><label>Workspace access key<input name="key" type="password" required minLength={32} autoComplete="current-password" placeholder="Enter your owner or judge key"/></label>{error&&<p className="error-banner" role="alert">{error}</p>}<button disabled={busy} className="button primary">{busy?<Loader2 className="spin" size={18}/>:<ArrowRight size={18}/>}Open workspace</button></form><div className="login-separator">Just exploring?</div><button disabled={busy} className="button secondary" onClick={()=>enter()}>Try the sample workspace <ArrowRight size={18}/></button><p className="quiet-note">No signup needed. The sample uses fictional documents and makes no AI calls. Your session is isolated from other visitors.</p></section></main></div>;
}
