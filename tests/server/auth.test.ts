import { describe, it, expect, beforeAll } from "vitest";
import { verifyAdminPassword, signSession, verifySession } from "@/server/auth";

beforeAll(() => {
  process.env.ADMIN_PASSWORD = "secret";
  process.env.SESSION_SECRET = "test-secret-value";
});

describe("auth", () => {
  it("verifies the correct admin password", () => {
    expect(verifyAdminPassword("secret")).toBe(true);
    expect(verifyAdminPassword("wrong")).toBe(false);
  });

  it("issues and verifies a session token", () => {
    const token = signSession();
    expect(verifySession(token)).toBe(true);
  });

  it("rejects a tampered or missing token", () => {
    expect(verifySession(undefined)).toBe(false);
    expect(verifySession("bogus.token")).toBe(false);
    const token = signSession();
    expect(verifySession(token + "x")).toBe(false);
  });
});
