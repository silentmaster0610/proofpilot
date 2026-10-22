import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createSession, digest, matchesKey, SESSION_COOKIE, validOrigin } from "../../../lib/auth";
import { hashPassword, verifyPassword, PasswordBusyError } from "../../../lib/password";
import { consumeLimit, getClient } from "../../../db";
export const runtime = "nodejs";
const credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(128),
});
const registration = credentials.extend({
  name: z.string().trim().min(1).max(60),
  confirmPassword: z.string(),
  workspaceKey: z.string().max(256).optional(),
}).refine(input => input.password === input.confirmPassword, { message: "Passwords do not match." });
const response = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  if (!validOrigin(req)) return response({ error: "Invalid request origin." }, 403);
  const raw = await req.text();
  if (raw.length > 2000) return response({ error: "Request too large." }, 413);
  let input;
  try { input = JSON.parse(raw); } catch { return response({ error: "Invalid request." }, 400); }
  if (!input || typeof input !== "object" || Array.isArray(input)) return response({ error: "Invalid request." }, 400);
  try {
    if (!await consumeLimit("login:global", 100, 60000)) return response({ error: "Too many attempts. Try again in a minute." }, 429);
    let session;
    if (input.action === "signup" || input.action === "login") {
      const parsed = (input.action === "signup" ? registration : credentials).safeParse(input);
      if (!parsed.success) return response({ error: "Enter a valid email and a password of 8–128 characters. For a new account, add your name and matching passwords." }, 400);
      const { email, password } = parsed.data;
      const limitKey = `login:email:${digest(email)}`;
      if (!await consumeLimit(limitKey, 10, 15 * 60000)) return response({ error: "Too many attempts for this email. Try again in 15 minutes." }, 429);
      const db = await getClient();
      let userId: string;
      if (input.action === "signup") {
        const details = registration.parse(input);
        if (!await consumeLimit("signup:global", 20, 3600000)) return response({ error: "New account signups are busy. Please try again in an hour, or explore the sample." }, 429);
        if (details.workspaceKey && !matchesKey(details.workspaceKey, process.env.PROOFPILOT_OWNER_KEY)) return response({ error: "That existing workspace key is not valid. Leave it blank to create a new workspace." }, 401);
        // An existing owner workspace can only be linked with proof of its key.
        userId = details.workspaceKey ? "owner" : `account:${randomUUID()}`;
        const passwordHash = await hashPassword(password);
        const result = await db.execute({
          sql: "INSERT INTO accounts(user_id,email,display_name,password_hash,created_at) VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING RETURNING user_id",
          args: [userId, email, details.name, passwordHash, new Date().toISOString()],
        });
        if (!result.rows.length) return response({ error: "This email or existing workspace already has an account. Please sign in." }, 409);
      } else {
        const result = await db.execute({ sql: "SELECT user_id,password_hash FROM accounts WHERE email=?", args: [email] });
        const account = result.rows[0];
        if (!await verifyPassword(password, account ? String(account.password_hash) : undefined)) return response({ error: "Email or password is incorrect." }, 401);
        userId = String(account.user_id);
      }
      await db.execute({ sql: "DELETE FROM rate_limits WHERE key=?", args: [limitKey] });
      session = await createSession(userId === "owner" ? "owner" : "member", userId);
    } else if (input.action === undefined) {
      // Compatibility for existing owner/judge keys and anonymous sample sessions.
      const key = typeof input.key === "string" ? input.key : "";
      const role = input.demo === true ? "demo" : matchesKey(key, process.env.PROOFPILOT_OWNER_KEY) ? "owner" : matchesKey(key, process.env.PROOFPILOT_JUDGE_KEY) ? "judge" : null;
      if (!role) return response({ error: "That access key is not valid." }, 401);
      session = await createSession(role);
    } else return response({ error: "Invalid sign-in action." }, 400);
    (await cookies()).set(SESSION_COOKIE, session.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: session.maxAge });
    return response({ ok: true });
  } catch (error) {
    if (error instanceof PasswordBusyError) return response({ error: "Sign-in is busy. Please try again in a few seconds." }, 503);
    if (error instanceof Error && /401|unauthorized/i.test(error.message)) return response({ error: "The workspace database isn't connected yet. The site owner needs to check its database credentials." }, 503);
    return response({ error: "We couldn't open your workspace. Please try again shortly." }, 503);
  }
}
export async function DELETE(req: Request) {
  if (!validOrigin(req)) return response({ error: "Invalid request origin." }, 403);
  const jar = await cookies(), token = jar.get(SESSION_COOKIE)?.value;
  if (token) await (await getClient()).execute({sql:"DELETE FROM sessions WHERE token_hash=?",args:[digest(token)]});
  jar.delete(SESSION_COOKIE);
  return response({ ok: true });
}
