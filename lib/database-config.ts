import { readFileSync, statSync } from "node:fs";
import { isAbsolute } from "node:path";
import { parseEnv } from "node:util";

// Accept common single-value paste formats without changing the credential itself.
export function normalizeDatabaseToken(raw?: string) {
  let value = raw?.trim() || "";
  if (value.startsWith("TURSO_AUTH_TOKEN=")) value = value.slice("TURSO_AUTH_TOKEN=".length).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1).trim();
  return value || undefined;
}

export function tokenFormat(token?: string) {
  if (!token) return "missing";
  if (/[\r\n]/.test(token)) return "multiple_lines";
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) ? "jwt" : "unrecognized";
}

export function parseDatabaseTokenFile(contents: string) {
  const text = contents.trim();
  let value: unknown;
  if (text.startsWith("{")) {
    try { const data = JSON.parse(text); value = data.TURSO_AUTH_TOKEN ?? data.tursoAuthToken; }
    catch { throw new Error("Database secret file contains invalid configuration."); }
  } else {
    const env = parseEnv(text);
    value = env.TURSO_AUTH_TOKEN;
    if (value === undefined && !/[\r\n]/.test(text) && Object.keys(env).length === 0) value = text;
  }
  const token = typeof value === "string" ? normalizeDatabaseToken(value) : undefined;
  if (!token || /[\r\n]/.test(token)) throw new Error("Database secret file must contain a token or TURSO_AUTH_TOKEN entry.");
  return token;
}

export function loadDatabaseToken(environmentValue?: string, secretFile?: string) {
  const token = normalizeDatabaseToken(environmentValue);
  if (token) return { token, source: "environment" as const };
  if (!secretFile?.trim()) return { token: undefined, source: "missing" as const };
  const path = secretFile.trim();
  if (!isAbsolute(path)) throw new Error("Database secret file path must be absolute.");
  let contents: string;
  try {
    if (statSync(path).size > 65536) throw new Error("File too large");
    contents = readFileSync(path, "utf8");
  } catch { throw new Error("Database secret file could not be read."); }
  return { token: parseDatabaseTokenFile(contents), source: "secret_file" as const };
}
