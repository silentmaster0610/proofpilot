"use client";
import { useState, FormEvent } from "react";
import { ArrowRight, CheckCheck, ShieldCheck, FileText, Fingerprint, Loader2, Eye, EyeOff } from "lucide-react";
import ThemeToggle from "../theme-toggle";
export default function Login() {
  const [mode, setMode] = useState<"signup" | "login" | "key">("signup");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  function switchMode(next: typeof mode) { setMode(next); setError(""); setShowPassword(false); }
  async function enter(input: Record<string, unknown>) {
    setBusy(true); setError("");
    try {
      const r=await fetch("/api/session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});
      const d=await r.json().catch(() => null);
      if(!d) throw new Error("The server is temporarily unavailable. Wait a moment and try again.");
      if(!r.ok)throw new Error(d.error || "Please try again.");
      location.assign("/");
    }catch(e){setError((e as Error).message);setBusy(false);}
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    if (mode === "signup" && values.password !== values.confirmPassword) { setError("Passwords don't match. Please enter the same password twice."); return; }
    void enter(mode === "key" ? { key: values.key } : { ...values, action: mode });
  }
  const signup = mode === "signup";
  return <div className="login-page"><header><a className="brand" href="/"><span className="brand-icon"><CheckCheck/></span>ProofPilot<span className="brand-dot">.</span></a><ThemeToggle/></header>
    <main className="login-grid"><section className="login-story"><p className="eyebrow">YOUR PAPERWORK. YOUR POWER.</p><h1>Life happens.<br/><em>Keep the proof.</em></h1><p>Turn receipts and policies into a clear next step. An assistant that finds the evidence, prepares the words, and leaves the decision with you.</p>
    <div className="login-features"><div><FileText/><span>Evidence you can trace</span></div><div><ShieldCheck/><span>Approval before action</span></div><div><Fingerprint/><span>A record of every draft</span></div></div><small>Built for NVIDIA Nemotron on Nebius Token Factory</small></section>
    <section className="panel login-card" aria-label="Your account"><span className="large-icon"><ShieldCheck size={28} /></span>
      <div className="login-tabs" aria-label="Account options"><button type="button" disabled={busy} aria-pressed={signup} onClick={() => switchMode("signup")}>Create account</button><button type="button" disabled={busy} aria-pressed={mode === "login"} onClick={() => switchMode("login")}>Sign in</button></div>
      <h2>{signup ? "Your space. Your proof." : mode === "login" ? "Welcome back." : "Open an existing workspace."}</h2>
      <p>{signup ? "First time here? Create your account and start your own private workspace." : mode === "login" ? "Sign in with your email and password. Your saved work will be here." : "For an earlier owner workspace or a judge invitation."}</p>
      <form key={mode} onSubmit={submit} aria-busy={busy}>
        <fieldset disabled={busy}>
          {signup && <label>Your name<input name="name" required maxLength={60} autoComplete="name" placeholder="What should we call you?" /></label>}
          {mode !== "key" ? <>
            <label>Email address<input name="email" type="email" required maxLength={254} autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="you@example.com" /></label>
            <label htmlFor="account-password">Password</label><div className="password-field"><input id="account-password" name="password" type={showPassword ? "text" : "password"} required minLength={8} maxLength={128} autoComplete={signup ? "new-password" : "current-password"} placeholder={signup ? "At least 8 characters" : "Enter your password"} aria-describedby={signup ? "password-hint" : undefined} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button></div>
            {signup && <><small id="password-hint" className="password-hint">Choose a password of 8 or more characters.</small><label>Confirm password<input name="confirmPassword" type={showPassword ? "text" : "password"} required minLength={8} maxLength={128} autoComplete="new-password" placeholder="Enter it once more" /></label><details className="workspace-import"><summary>Already have an owner workspace?</summary><p>Optional: enter its existing key to keep that workspace with your new account. Leave blank for a fresh start.</p><label>Existing workspace key<input name="workspaceKey" type="password" maxLength={256} autoComplete="off" placeholder="Optional — only for an older workspace" /></label></details></>}
          </> : <label>Existing access key<input name="key" type="password" required maxLength={256} autoComplete="off" placeholder="Paste the key you were given" /></label>}
        </fieldset>
        {error && <p className="error-banner" role="alert">{error}</p>}
        <button disabled={busy} className="button primary" type="submit">{busy ? <Loader2 className="spin" size={18} /> : <ArrowRight size={18} />}{busy ? "Opening your workspace…" : signup ? "Create my account" : mode === "login" ? "Sign in" : "Open workspace"}</button>
      </form>
      {mode !== "key" && <button type="button" className="text-button legacy-login" disabled={busy} onClick={() => switchMode("key")}>Have a judge or existing workspace key?</button>}
      <div className="login-separator">Just exploring?</div><button disabled={busy} className="button secondary" onClick={() => enter({ demo: true })}>Try the sample workspace <ArrowRight size={18} /></button><p className="quiet-note">No signup needed for the sample. It uses fictional documents and makes no AI calls.</p>
    </section></main></div>;
}
