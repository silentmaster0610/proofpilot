import { cookies } from "next/headers";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getClient } from "../db";
export const SESSION_COOKIE = "proofpilot_session";
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export type Identity = { userId: string; displayName: string; role: "owner" | "member" | "judge" | "demo" };
export function matchesKey(value: string, expected?: string) {
  if (!expected || expected.length < 32) return false;
  return timingSafeEqual(Buffer.from(digest(value)), Buffer.from(digest(expected)));
}
export async function createSession(role: Identity["role"], accountUserId?: string) {
  if (role === "member" && !accountUserId) throw new Error("Account identity is required.");
  const token = randomBytes(32).toString("hex");
  const userId = accountUserId || (role === "owner" ? "owner" : `${role}:${randomBytes(16).toString("hex")}`);
  const maxAge = (role === "demo" ? 1 : 30) * 86400;
  await (await getClient()).execute({sql:"INSERT INTO sessions VALUES(?,?,?,?)",args:[digest(token), userId, role, Date.now() + maxAge * 1000]});
  return { token, maxAge };
}
export async function getUser(): Promise<Identity | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const result=await (await getClient()).execute({sql:"SELECT s.user_id,s.role,a.display_name FROM sessions s LEFT JOIN accounts a ON a.user_id=s.user_id WHERE token_hash=? AND expires_at>?",args:[digest(token),Date.now()]});
  const row=result.rows[0] as unknown as { user_id: string; role: Identity["role"]; display_name?: string } | undefined;
  if (!row) return null;
  return { userId: row.user_id, role: row.role, displayName: row.display_name || (row.role === "owner" ? "My workspace" : row.role === "judge" ? "Judge workspace" : "Sample workspace") };
}
export function validOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const expected = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || new URL(req.url).origin;
  return !!origin && origin === new URL(expected).origin;
}
