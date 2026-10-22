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
