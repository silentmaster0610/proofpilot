import { cookies } from "next/headers";
import { createSession, digest, matchesKey, SESSION_COOKIE, validOrigin } from "../../../lib/auth";
import { consumeLimit, getClient } from "../../../db";
export const runtime = "nodejs";
export async function POST(req: Request) {
  if (!validOrigin(req)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  if (!await consumeLimit("login:global", 100, 60000)) return Response.json({ error: "Too many attempts. Try again in a minute." }, { status: 429 });
  const raw = await req.text();
  if (raw.length > 1000) return Response.json({ error: "Request too large." }, { status: 413 });
  let input;
  try { input = JSON.parse(raw); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  if (!input || typeof input !== "object" || Array.isArray(input)) return Response.json({ error: "Invalid request." }, { status: 400 });
  const key = typeof input.key === "string" ? input.key : "";
  const role = input.demo === true ? "demo" : matchesKey(key, process.env.PROOFPILOT_OWNER_KEY) ? "owner" : matchesKey(key, process.env.PROOFPILOT_JUDGE_KEY) ? "judge" : null;
  if (!role) return Response.json({ error: "That access key is not valid." }, { status: 401 });
  const session = await createSession(role);
  (await cookies()).set(SESSION_COOKIE, session.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: session.maxAge });
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
export async function DELETE(req: Request) {
  if (!validOrigin(req)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const jar = await cookies(), token = jar.get(SESSION_COOKIE)?.value;
  if (token) await (await getClient()).execute({sql:"DELETE FROM sessions WHERE token_hash=?",args:[digest(token)]});
  jar.delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
