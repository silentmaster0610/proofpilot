import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const options = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
let activeHashes = 0;
export class PasswordBusyError extends Error {}

// Bound memory use on the free server; passwords never enter logs or sessions.
async function derive(password: string, salt: string): Promise<Buffer> {
  if (activeHashes >= 2) throw new PasswordBusyError("Please try again in a few seconds.");
  activeHashes++;
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      scrypt(password, salt, 64, options, (error, key) => error ? reject(error) : resolve(key));
    });
  } finally { activeHashes--; }
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt-v1$${salt}$${(await derive(password, salt)).toString("hex")}`;
}

export async function verifyPassword(password: string, stored?: string) {
  const parts = stored?.split("$");
  const valid = parts?.length === 3 && parts[0] === "scrypt-v1" && /^[a-f0-9]{32}$/.test(parts[1]) && /^[a-f0-9]{128}$/.test(parts[2]);
  // Do the same expensive work for an unknown email, without accepting it.
  const actual = await derive(password, valid ? parts![1] : "0".repeat(32));
  const expected = Buffer.from(valid ? parts![2] : "0".repeat(128), "hex");
  return timingSafeEqual(actual, expected) && !!valid;
}
