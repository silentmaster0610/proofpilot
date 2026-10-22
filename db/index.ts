import { createClient, Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as schema from "./schema";
import { normalizeDatabaseToken, tokenFormat } from "../lib/database-config";
let client: Client | undefined;
let ready: Promise<void> | undefined;
let configurationReported = false;
export async function getClient() {
  if (ready) { await ready; return client!; }
  const path = resolve(process.env.DATABASE_PATH || "./data/proofpilot.sqlite");
  const remote=process.env.TURSO_DATABASE_URL?.trim();
  const authToken=remote?normalizeDatabaseToken(process.env.TURSO_AUTH_TOKEN):undefined;
  if(remote&&!configurationReported){
    configurationReported=true;
    // Only a format label is logged: never the token, URL, payload or a digest.
    console.info(`ProofPilot database token configuration: ${tokenFormat(authToken)}`);
  }
  if(process.env.REQUIRE_REMOTE_DB==="true"&&!remote)throw new Error("Remote database configuration is required.");
  if(!remote)mkdirSync(dirname(path), { recursive: true });
  client=createClient({url:remote||`file:${path.replace(/\\/g,"/")}`,authToken});
  ready = client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS workspaces (user_id TEXT PRIMARY KEY, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS automation_tokens (user_id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, role TEXT NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS accounts (user_id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
  `).then(()=>{if(remote)console.info("ProofPilot database connected; schema ready.");}).catch(e=>{
    if(remote){const message=e instanceof Error?e.message:"";console.error(`ProofPilot database connection: ${/401|unauthorized/i.test(message)?"authentication_rejected":/403|forbidden/i.test(message)?"permission_denied":"request_failed"}`);}
    ready=undefined;client?.close();client=undefined;throw e;
  });
  await ready;
  return client!;
}
export async function getDb() { return drizzle(await getClient(), { schema }); }
export async function consumeLimit(key: string, limit: number, windowMs: number) {
  const db = await getClient(), at = Date.now();
  const result = await db.execute({sql:`INSERT INTO rate_limits(key,count,reset_at) VALUES(?,1,?)
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at<=? THEN 1 ELSE count+1 END,
    reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END
    RETURNING count`,args:[key, at + windowMs, at, at]});
  return Number(result.rows[0].count) <= limit;
}
