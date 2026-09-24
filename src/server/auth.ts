import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function verifyAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error("ADMIN_PASSWORD is not set");
  return safeEqual(password, expected);
}

const PAYLOAD = "admin";

export function signSession(): string {
  const sig = createHmac("sha256", secret()).update(PAYLOAD).digest("hex");
  return `${PAYLOAD}.${sig}`;
}

export function verifySession(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (payload !== PAYLOAD || !sig) return false;
  const expected = createHmac("sha256", secret()).update(PAYLOAD).digest("hex");
  return safeEqual(sig, expected);
}
